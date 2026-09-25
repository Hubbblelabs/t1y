import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ContentLocale } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { gradeAttempt } from "@/lib/quizzes/grading";
import { listPublishedEducationBundle } from "@/lib/services/education";
import { listPublishedQuizBundle } from "@/lib/services/quizzes";
import { logger } from "@/lib/utils/logger";

/**
 * Offline sync push.
 *
 * The device queues events locally with a client-generated UUID and flushes
 * them in a batch when connectivity returns. Three properties matter more
 * than anything else here:
 *
 * 1. Partial success. Each event is applied in its own transaction. A single
 *    malformed event must never fail the whole batch — that would wedge a
 *    device permanently and lose a participant's data for the rest of the
 *    study.
 * 2. Idempotency via SyncEvent.clientId as primary key. A retried push
 *    inserts the ledger row first; a unique-constraint violation means "seen
 *    this exact event before" and the event is reported as a no-op duplicate
 *    rather than re-applied.
 * 3. Clock skew is recorded, never a rejection reason. Cheap Android clocks
 *    drift, and a factory-reset phone can be years off; rejecting on skew
 *    would silently delete study data instead of just noting it.
 */

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function clampToPlausibleRange(occurredAt: Date, now: Date): { clamped: Date; skewSeconds: number } {
  const skewSeconds = Math.round((occurredAt.getTime() - now.getTime()) / 1000);
  const min = now.getTime() - ONE_YEAR_MS;
  const max = now.getTime() + FIVE_MINUTES_MS;
  const clampedMs = Math.min(Math.max(occurredAt.getTime(), min), max);
  return { clamped: new Date(clampedMs), skewSeconds };
}

export type SyncEventInput =
  | {
      clientId: string;
      type: "TOPIC_OPEN";
      occurredAt: Date;
      payload: { topicSlug: string; locale: ContentLocale };
    }
  | {
      clientId: string;
      type: "TOPIC_COMPLETION";
      occurredAt: Date;
      payload: { topicSlug: string; locale: ContentLocale; secondsSpent: number };
    }
  | {
      clientId: string;
      type: "QUIZ_ATTEMPT";
      occurredAt: Date;
      payload: {
        quizSlug: string;
        locale: ContentLocale;
        startedAt: Date;
        completedAt?: Date;
        responses: { questionKey: string; answer: unknown; answeredAt: Date }[];
      };
    };

export interface SyncAccepted {
  clientId: string;
  status: "applied" | "duplicate";
  serverId: string;
}

export interface SyncRejected {
  clientId: string;
  code: "UNKNOWN_TOPIC" | "UNKNOWN_QUIZ" | "UNKNOWN_QUESTION" | "INTERNAL_ERROR";
  message: string;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function applyTopicEvent(
  userId: string,
  event: Extract<SyncEventInput, { type: "TOPIC_OPEN" | "TOPIC_COMPLETION" }>,
  occurredAt: Date,
  skewSeconds: number,
): Promise<SyncAccepted | SyncRejected> {
  const topicExists = await prisma.educationContent.findFirst({
    where: { slug: event.payload.topicSlug },
    select: { id: true },
  });
  if (!topicExists) {
    return { clientId: event.clientId, code: "UNKNOWN_TOPIC", message: "No such topic." };
  }

  const secondsSpent = event.type === "TOPIC_COMPLETION" ? event.payload.secondsSpent : 0;
  const completedAt = event.type === "TOPIC_COMPLETION" ? occurredAt : undefined;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.syncEvent.create({
        data: {
          clientId: event.clientId,
          userId,
          type: event.type,
          occurredAt,
          clockSkewSeconds: skewSeconds,
        },
      });

      const existing = await tx.topicProgress.findUnique({
        where: { userId_topicSlug: { userId, topicSlug: event.payload.topicSlug } },
        select: { completedAt: true },
      });

      await tx.topicProgress.upsert({
        where: { userId_topicSlug: { userId, topicSlug: event.payload.topicSlug } },
        create: {
          userId,
          topicSlug: event.payload.topicSlug,
          locale: event.payload.locale,
          firstOpenedAt: occurredAt,
          lastOpenedAt: occurredAt,
          completedAt,
          secondsSpent,
          openCount: 1,
        },
        update: {
          locale: event.payload.locale,
          lastOpenedAt: occurredAt,
          // Never un-complete a topic once it's been marked done.
          completedAt: existing?.completedAt ?? completedAt,
          secondsSpent: { increment: secondsSpent },
          openCount: { increment: 1 },
        },
      });
    });

    return { clientId: event.clientId, status: "applied", serverId: event.clientId };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { clientId: event.clientId, status: "duplicate", serverId: event.clientId };
    }
    throw error;
  }
}

async function applyQuizAttemptEvent(
  userId: string,
  event: Extract<SyncEventInput, { type: "QUIZ_ATTEMPT" }>,
  occurredAt: Date,
  skewSeconds: number,
): Promise<SyncAccepted | SyncRejected> {
  const quiz = await prisma.quiz.findFirst({
    where: { slug: event.payload.quizSlug, locale: event.payload.locale },
    select: {
      id: true,
      version: true,
      passingScore: true,
      questions: {
        where: { retiredAt: null },
        select: {
          id: true,
          type: true,
          points: true,
          questionKey: true,
          options: { select: { id: true, isCorrect: true, correctPosition: true } },
        },
      },
    },
  });
  if (!quiz) {
    return { clientId: event.clientId, code: "UNKNOWN_QUIZ", message: "No such quiz." };
  }

  const questionByKey = new Map(quiz.questions.map((q) => [q.questionKey, q]));
  const responsesByQuestionId: { questionId: string; answer: unknown; answeredAt: Date }[] = [];
  for (const response of event.payload.responses) {
    const question = questionByKey.get(response.questionKey);
    if (!question) {
      return {
        clientId: event.clientId,
        code: "UNKNOWN_QUESTION",
        message: `Unknown question "${response.questionKey}" for this quiz.`,
      };
    }
    responsesByQuestionId.push({
      questionId: question.id,
      answer: response.answer,
      answeredAt: response.answeredAt,
    });
  }

  const graded = gradeAttempt(
    quiz.questions.map((q) => ({ id: q.id, type: q.type, points: q.points, options: q.options })),
    responsesByQuestionId.map((r) => ({
      questionId: r.questionId,
      answer: r.answer as never,
    })),
    quiz.passingScore,
  );
  const gradeByQuestion = new Map(graded.graded.map((g) => [g.questionId, g]));

  try {
    const attempt = await prisma.$transaction(async (tx) => {
      await tx.syncEvent.create({
        data: {
          clientId: event.clientId,
          userId,
          type: "QUIZ_ATTEMPT",
          occurredAt,
          clockSkewSeconds: skewSeconds,
        },
      });

      const attemptNumber =
        (await tx.quizAttempt.count({ where: { userId, quizId: quiz.id } })) + 1;

      return tx.quizAttempt.create({
        data: {
          clientId: event.clientId,
          userId,
          quizId: quiz.id,
          locale: event.payload.locale,
          startedAt: event.payload.startedAt,
          completedAt: event.payload.completedAt ?? occurredAt,
          scorePercent: graded.scorePercent,
          pointsAwarded: graded.pointsAwarded,
          pointsPossible: graded.pointsPossible,
          passed: graded.passed,
          attemptNumber,
          quizVersion: quiz.version,
          responses: {
            create: responsesByQuestionId.map((r) => {
              const g = gradeByQuestion.get(r.questionId);
              return {
                questionId: r.questionId,
                answer: r.answer as Prisma.InputJsonValue,
                isCorrect: g?.isCorrect ?? false,
                pointsAwarded: g?.pointsAwarded ?? 0,
                answeredAt: r.answeredAt,
              };
            }),
          },
        },
        select: { id: true },
      });
    });

    return { clientId: event.clientId, status: "applied", serverId: attempt.id };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { clientId: event.clientId, status: "duplicate", serverId: event.clientId };
    }
    throw error;
  }
}

export async function pushSyncBatch(
  userId: string,
  events: SyncEventInput[],
): Promise<{ accepted: SyncAccepted[]; rejected: SyncRejected[] }> {
  const now = new Date();
  const accepted: SyncAccepted[] = [];
  const rejected: SyncRejected[] = [];

  for (const event of events) {
    const { clamped, skewSeconds } = clampToPlausibleRange(event.occurredAt, now);

    try {
      const result =
        event.type === "QUIZ_ATTEMPT"
          ? await applyQuizAttemptEvent(userId, event, clamped, skewSeconds)
          : await applyTopicEvent(userId, event, clamped, skewSeconds);

      if ("status" in result) accepted.push(result);
      else rejected.push(result);
    } catch (error) {
      // A single event failing must never fail the batch — see module doc.
      logger.error("sync.event_failed", {
        userId,
        clientId: event.clientId,
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
      rejected.push({
        clientId: event.clientId,
        code: "INTERNAL_ERROR",
        message: "This event could not be processed. It will be retried.",
      });
    }
  }

  return { accepted, rejected };
}

/**
 * Content + quiz bundles plus the participant's own progress, in one
 * response — what a device calls on install or after a factory reset to
 * recover state without re-downloading everything topic-by-topic.
 */
export async function getSyncBootstrap(userId: string, locale: ContentLocale) {
  const [content, quizzes, progress, attempts] = await Promise.all([
    listPublishedEducationBundle(locale),
    listPublishedQuizBundle(locale),
    prisma.topicProgress.findMany({ where: { userId } }),
    prisma.quizAttempt.findMany({
      where: { userId },
      select: {
        quizId: true,
        scorePercent: true,
        passed: true,
        completedAt: true,
        attemptNumber: true,
      },
      orderBy: { attemptNumber: "desc" },
    }),
  ]);

  return {
    locale,
    serverTime: new Date().toISOString(),
    content,
    quizzes,
    progress,
    attempts,
  };
}

import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { ContentLocale, ContentStatus } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import type { GradableQuestion } from "@/lib/quizzes/grading";

/**
 * Quiz authoring and reading.
 *
 * Mirrors lib/services/education.ts's shape (list/get/create/update/delete/
 * stats), with one structural difference: `updateQuiz` never deletes and
 * recreates questions. A participant's `QuizResponse` rows reference
 * `QuizQuestion` with `onDelete: Restrict`, so the obvious "replace all
 * questions" implementation would either throw on the first edit to a quiz
 * with attempts, or (if written carelessly) silently destroy study data.
 * Removed questions are soft-retired via `retiredAt` instead.
 */

const OPTION_SELECT = {
  id: true,
  position: true,
  text: true,
  matchText: true,
  isCorrect: true,
  correctPosition: true,
} satisfies Prisma.QuizOptionSelect;

const QUESTION_SELECT = {
  id: true,
  type: true,
  questionKey: true,
  prompt: true,
  explanation: true,
  imageUrl: true,
  points: true,
  position: true,
  options: { orderBy: { position: "asc" }, select: OPTION_SELECT },
} satisfies Prisma.QuizQuestionSelect;

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  locale: true,
  topicSlug: true,
  title: true,
  description: true,
  passingScore: true,
  maxAttempts: true,
  shuffleQuestions: true,
  publishedAt: true,
  version: true,
  questions: {
    where: { retiredAt: null },
    orderBy: { position: "asc" },
    select: QUESTION_SELECT,
  },
} satisfies Prisma.QuizSelect;

const ADMIN_SELECT = {
  ...PUBLIC_SELECT,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  // Admin views include retired questions too, for audit/history purposes.
  questions: {
    orderBy: { position: "asc" },
    select: QUESTION_SELECT,
  },
  _count: { select: { attempts: true } },
} satisfies Prisma.QuizSelect;

export async function listPublishedQuizzes(params: {
  locale?: ContentLocale;
  topicSlug?: string;
  skip: number;
  take: number;
}) {
  const locale = params.locale ?? "EN";
  const where: Prisma.QuizWhereInput = {
    status: "PUBLISHED",
    locale,
    ...(params.topicSlug ? { topicSlug: params.topicSlug } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      select: { ...PUBLIC_SELECT, questions: false },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.quiz.count({ where }),
  ]);

  return { items, total };
}

export async function getPublishedQuizBySlug(slug: string, locale: ContentLocale = "EN") {
  const quiz = await prisma.quiz.findFirst({
    where: { slug, locale, status: "PUBLISHED" },
    select: PUBLIC_SELECT,
  });
  if (!quiz) throw new NotFoundError("Quiz");
  return quiz;
}

/**
 * Every published quiz, for the mobile client's one-shot offline download.
 *
 * Falls back to English per topic, exactly as education content does. A hard
 * locale filter here meant a Tamil participant saw an empty Quizzes tab —
 * the study's quizzes are currently English-only, so `locale=TA` matched
 * nothing at all. An untranslated quiz should degrade to English with a
 * flag, never vanish: a missing translation must not silently remove a piece
 * of the curriculum from a participant's app.
 *
 * Quizzes are paired to topics by `topicSlug` (the language-independent
 * topic identity), so that — not the quiz's own slug — is what collapses.
 */
export async function listPublishedQuizBundle(locale: ContentLocale = "EN") {
  const rows = await prisma.quiz.findMany({
    where: {
      status: "PUBLISHED",
      ...(locale === "EN" ? { locale: "EN" } : { locale: { in: [locale, "EN"] } }),
    },
    select: PUBLIC_SELECT,
    orderBy: { sortOrder: "asc" },
  });

  const byTopic = new Map<string, (typeof rows)[number] & { isFallback: boolean }>();
  for (const row of rows) {
    const key = row.topicSlug ?? row.slug;
    const existing = byTopic.get(key);
    const isPreferred = row.locale === locale;
    if (!existing || (isPreferred && existing.locale !== locale)) {
      byTopic.set(key, { ...row, isFallback: row.locale !== locale });
    }
  }

  return [...byTopic.values()];
}

/** Shape consumed directly by lib/quizzes/grading.ts. */
export function toGradableQuestions(
  questions: { id: string; type: string; points: number; options: { id: string; isCorrect: boolean; correctPosition: number | null }[] }[],
): GradableQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    type: q.type as GradableQuestion["type"],
    points: q.points,
    options: q.options,
  }));
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export async function listQuizzesForAdmin(params: {
  status?: ContentStatus;
  locale?: ContentLocale;
  topicSlug?: string;
  search?: string;
  skip: number;
  take: number;
}) {
  const where: Prisma.QuizWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.locale ? { locale: params.locale } : {}),
    ...(params.topicSlug ? { topicSlug: params.topicSlug } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" } },
            { slug: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      select: { ...ADMIN_SELECT, questions: false },
      orderBy: { updatedAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.quiz.count({ where }),
  ]);

  return { items, total };
}

export async function getQuizById(id: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id }, select: ADMIN_SELECT });
  if (!quiz) throw new NotFoundError("Quiz");
  return quiz;
}

export interface QuizOptionInput {
  text: string;
  matchText?: string;
  isCorrect?: boolean;
  correctPosition?: number;
}

export interface QuizQuestionInput {
  type: "SINGLE_CHOICE" | "TRUE_FALSE" | "MATCHING" | "ORDERING";
  questionKey: string;
  prompt: string;
  explanation?: string;
  imageUrl?: string;
  points?: number;
  position: number;
  options: QuizOptionInput[];
}

export interface QuizInput {
  slug: string;
  locale?: ContentLocale;
  topicSlug?: string;
  title: string;
  description?: string;
  passingScore?: number | null;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  status?: ContentStatus;
  sortOrder?: number;
  questions: QuizQuestionInput[];
}

export async function createQuiz(authorId: string, input: QuizInput) {
  const locale = input.locale ?? "EN";
  const existing = await prisma.quiz.findUnique({
    where: { slug_locale: { slug: input.slug, locale } },
    select: { id: true },
  });
  if (existing) throw new ConflictError(`A ${locale} quiz with this slug already exists.`);

  const { questions, ...quizFields } = input;

  return prisma.quiz.create({
    data: {
      ...quizFields,
      locale,
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      authorId,
      questions: {
        create: questions.map((q) => ({
          type: q.type,
          questionKey: q.questionKey,
          prompt: q.prompt,
          explanation: q.explanation,
          imageUrl: q.imageUrl,
          points: q.points ?? 1,
          position: q.position,
          options: {
            create: q.options.map((o, index) => ({
              position: index,
              text: o.text,
              matchText: o.matchText,
              isCorrect: o.isCorrect ?? false,
              correctPosition: o.correctPosition,
            })),
          },
        })),
      },
    },
    select: ADMIN_SELECT,
  });
}

/**
 * Reconciles questions by `questionKey` rather than replacing wholesale:
 *   - present in input, matches an existing question -> update in place
 *     (and delete+recreate its options, which carry no independent identity
 *     participants reference)
 *   - present in input, no existing match -> create
 *   - existing, absent from input -> soft-retire (retiredAt), never deleted
 *
 * This is the guard that keeps "fix a typo in a quiz" from destroying
 * recorded QuizResponse rows.
 */
export async function updateQuiz(id: string, input: Partial<Omit<QuizInput, "slug" | "locale">>) {
  const current = await prisma.quiz.findUnique({
    where: { id },
    select: { publishedAt: true, questions: { select: { id: true, questionKey: true } } },
  });
  if (!current) throw new NotFoundError("Quiz");

  const publishedAt =
    input.status === "PUBLISHED" && current.publishedAt === null
      ? new Date()
      : input.status === "DRAFT"
        ? null
        : undefined;

  const { questions, ...quizFields } = input;

  await prisma.$transaction(async (tx) => {
    await tx.quiz.update({
      where: { id },
      data: {
        ...quizFields,
        ...(publishedAt !== undefined ? { publishedAt } : {}),
        version: { increment: 1 },
      },
    });

    if (!questions) return;

    const incomingKeys = new Set(questions.map((q) => q.questionKey));
    const toRetire = current.questions.filter((q) => !incomingKeys.has(q.questionKey));
    if (toRetire.length > 0) {
      await tx.quizQuestion.updateMany({
        where: { id: { in: toRetire.map((q) => q.id) } },
        data: { retiredAt: new Date() },
      });
    }

    for (const q of questions) {
      const existing = current.questions.find((c) => c.questionKey === q.questionKey);

      if (existing) {
        await tx.quizOption.deleteMany({ where: { questionId: existing.id } });
        await tx.quizQuestion.update({
          where: { id: existing.id },
          data: {
            type: q.type,
            prompt: q.prompt,
            explanation: q.explanation,
            imageUrl: q.imageUrl,
            points: q.points ?? 1,
            position: q.position,
            retiredAt: null,
            options: {
              create: q.options.map((o, index) => ({
                position: index,
                text: o.text,
                matchText: o.matchText,
                isCorrect: o.isCorrect ?? false,
                correctPosition: o.correctPosition,
              })),
            },
          },
        });
      } else {
        await tx.quizQuestion.create({
          data: {
            quizId: id,
            type: q.type,
            questionKey: q.questionKey,
            prompt: q.prompt,
            explanation: q.explanation,
            imageUrl: q.imageUrl,
            points: q.points ?? 1,
            position: q.position,
            options: {
              create: q.options.map((o, index) => ({
                position: index,
                text: o.text,
                matchText: o.matchText,
                isCorrect: o.isCorrect ?? false,
                correctPosition: o.correctPosition,
              })),
            },
          },
        });
      }
    }
  });

  return getQuizById(id);
}

export async function setQuizStatus(id: string, status: ContentStatus) {
  const current = await prisma.quiz.findUnique({ where: { id }, select: { publishedAt: true } });
  if (!current) throw new NotFoundError("Quiz");

  return prisma.quiz.update({
    where: { id },
    data: {
      status,
      publishedAt:
        status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
    },
    select: ADMIN_SELECT,
  });
}

/** A quiz with recorded attempts can never be deleted outright — see QuizAttempt.quiz onDelete: Restrict. */
export async function deleteQuiz(id: string): Promise<void> {
  const attemptCount = await prisma.quizAttempt.count({ where: { quizId: id } });
  if (attemptCount > 0) {
    throw new ConflictError(
      `This quiz has ${attemptCount} recorded attempt(s) and cannot be deleted. Archive it instead.`,
    );
  }
  await prisma.quiz.delete({ where: { id } });
}

export async function getQuizStats() {
  const grouped = await prisma.quiz.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = new Map(grouped.map((row) => [row.status, row._count._all]));

  return {
    total: grouped.reduce((sum, row) => sum + row._count._all, 0),
    published: counts.get("PUBLISHED") ?? 0,
    draft: counts.get("DRAFT") ?? 0,
    archived: counts.get("ARCHIVED") ?? 0,
  };
}

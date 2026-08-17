import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Read-side of topic/quiz progress, for the admin research view. Writes
 * happen exclusively through lib/services/sync.ts's offline push — there is
 * no direct "mark topic complete" admin action, since that would let staff
 * fabricate study adherence data.
 */

export async function listProgressForUser(userId: string) {
  const [topics, attempts] = await Promise.all([
    prisma.topicProgress.findMany({
      where: { userId },
      orderBy: { lastOpenedAt: "desc" },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      select: {
        id: true,
        quizId: true,
        quiz: { select: { slug: true, title: true } },
        locale: true,
        startedAt: true,
        completedAt: true,
        scorePercent: true,
        passed: true,
        attemptNumber: true,
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return { topics, attempts };
}

/**
 * Cohort-level adherence summary: what fraction of participants have opened
 * / completed each topic, and quiz pass rates. This is the app's own
 * engagement proxy, distinct from the clinical PedsQL/WE-CARE outcome
 * measures (which are collected outside the app).
 */
export async function getCohortProgress() {
  const [totalParticipants, topicStats, quizStats] = await Promise.all([
    prisma.user.count({ where: { role: "PATIENT", status: "ACTIVE" } }),
    prisma.topicProgress.groupBy({
      by: ["topicSlug"],
      _count: { _all: true },
    }),
    prisma.quiz.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        title: true,
        locale: true,
        _count: { select: { attempts: true } },
        attempts: { select: { passed: true }, where: { completedAt: { not: null } } },
      },
    }),
  ]);

  const completedByTopic = await prisma.topicProgress.groupBy({
    by: ["topicSlug"],
    where: { completedAt: { not: null } },
    _count: { _all: true },
  });
  const completedMap = new Map(completedByTopic.map((row) => [row.topicSlug, row._count._all]));

  return {
    totalParticipants,
    topics: topicStats.map((row) => ({
      topicSlug: row.topicSlug,
      opened: row._count._all,
      completed: completedMap.get(row.topicSlug) ?? 0,
    })),
    quizzes: quizStats.map((quiz) => ({
      slug: quiz.slug,
      title: quiz.title,
      locale: quiz.locale,
      attempts: quiz._count.attempts,
      passRate:
        quiz.attempts.length > 0
          ? Math.round(
              (quiz.attempts.filter((a) => a.passed === true).length / quiz.attempts.length) * 100,
            )
          : null,
    })),
  };
}

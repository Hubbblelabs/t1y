import "server-only";

import type { BadgeTier } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Quiz badges — the app's engagement layer for children aged 6-15.
 *
 * Two rules shape everything here:
 *
 *   1. A badge is *derived* from a scored QuizAttempt and never awarded on
 *      the client's say-so. The app can render a celebration immediately
 *      from the score it was handed, but the badge that persists is the one
 *      this module computes from the attempt the server graded.
 *
 *   2. A child holds at most one badge per quiz, always their best. Retaking
 *      a quiz can only improve the wall, never dent it — a child who scores
 *      95 then 60 keeps the gold. That makes retrying feel free, which is
 *      the point of having badges at all.
 *
 * None of this feeds the study's outcome measures; QuizAttempt remains the
 * record of what actually happened.
 */

/**
 * Score bands. Ordered high-to-low and evaluated in order, so the first
 * threshold a score clears wins. Below the lowest band there is no badge —
 * the app shows "you gave it your best, try again" rather than inventing a
 * participation tier.
 */
const TIER_THRESHOLDS: ReadonlyArray<{ tier: BadgeTier; minScore: number }> = [
  { tier: "GOLD", minScore: 91 },
  { tier: "SILVER", minScore: 81 },
  { tier: "BRONZE", minScore: 61 },
  { tier: "RISING", minScore: 51 },
];

/** Rank for comparisons — higher is better. Mirrors TIER_THRESHOLDS' order. */
const TIER_RANK: Record<BadgeTier, number> = {
  GOLD: 4,
  SILVER: 3,
  BRONZE: 2,
  RISING: 1,
};

/** The tier a score earns, or null when it earns none. */
export function tierForScore(scorePercent: number): BadgeTier | null {
  return TIER_THRESHOLDS.find((band) => scorePercent >= band.minScore)?.tier ?? null;
}

export interface AwardedBadge {
  tier: BadgeTier;
  scorePercent: number;
  /** True when this beat the child's previous badge for the same quiz. */
  isNewBest: boolean;
  /** What they held before, so the app can show "Bronze → Gold". */
  previousTier: BadgeTier | null;
}

/**
 * Records the badge for a completed attempt, if it earns one and beats what
 * the child already holds for that quiz.
 *
 * Returns what the app should celebrate: null when the score earned no badge
 * at all, or a result whose `isNewBest` is false when they've simply matched
 * or fallen short of their own record — worth acknowledging without
 * pretending it was new.
 */
export async function awardBadgeForAttempt(attemptId: string): Promise<AwardedBadge | null> {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      quizId: true,
      scorePercent: true,
      completedAt: true,
    },
  });

  // An abandoned or ungraded attempt earns nothing — a badge must always
  // trace back to a real, finished, server-scored result.
  if (!attempt?.completedAt || attempt.scorePercent === null) return null;

  const tier = tierForScore(attempt.scorePercent);
  if (!tier) return null;

  const existing = await prisma.quizBadge.findUnique({
    where: { userId_quizId: { userId: attempt.userId, quizId: attempt.quizId } },
    select: { tier: true, scorePercent: true },
  });

  const isNewBest = !existing || attempt.scorePercent > existing.scorePercent;

  if (isNewBest) {
    await prisma.quizBadge.upsert({
      where: { userId_quizId: { userId: attempt.userId, quizId: attempt.quizId } },
      create: {
        userId: attempt.userId,
        quizId: attempt.quizId,
        tier,
        scorePercent: attempt.scorePercent,
        attemptId: attempt.id,
      },
      update: {
        tier,
        scorePercent: attempt.scorePercent,
        attemptId: attempt.id,
        earnedAt: new Date(),
      },
    });
  }

  return {
    tier,
    scorePercent: attempt.scorePercent,
    isNewBest,
    previousTier: existing?.tier ?? null,
  };
}

export interface BadgeCollection {
  badges: Array<{
    quizId: string;
    quizSlug: string;
    quizTitle: string;
    tier: BadgeTier;
    scorePercent: number;
    earnedAt: Date;
  }>;
  /** Badges held — one per quiz, so this is also "quizzes conquered". */
  totalBadges: number;
  /** Published quizzes overall, so the app can show what is still unbadged. */
  totalQuizzes: number;
  /**
   * Distinct quizzes this child has actually completed at least once. Drives
   * the badge's glow on the rewards screen — how much of the course they've
   * *taken*, which is a different question from how many they scored well
   * enough on to earn a badge.
   */
  quizzesAttempted: number;
  /**
   * Mean best-score across the quizzes attempted, rounded. Null until at
   * least one quiz is complete — a rank derived from no data would be a
   * guess dressed as an achievement.
   */
  averageScore: number | null;
  countsByTier: Record<BadgeTier, number>;
}

/** Everything the badge/trophy screen renders, in one round trip. */
export async function getBadgeCollection(userId: string): Promise<BadgeCollection> {
  const [badges, totalQuizzes, attempted] = await Promise.all([
    prisma.quizBadge.findMany({
      where: { userId },
      select: {
        quizId: true,
        tier: true,
        scorePercent: true,
        earnedAt: true,
        quiz: { select: { slug: true, title: true } },
      },
      orderBy: { earnedAt: "desc" },
    }),
    prisma.quiz.count({ where: { status: "PUBLISHED" } }),
    // Best score per distinct quiz completed. Grouped rather than averaged
    // over every attempt, so a child who retakes one quiz five times isn't
    // weighted five times against a child who took five different quizzes.
    prisma.quizAttempt.groupBy({
      by: ["quizId"],
      where: { userId, completedAt: { not: null }, scorePercent: { not: null } },
      _max: { scorePercent: true },
    }),
  ]);

  const countsByTier: Record<BadgeTier, number> = {
    GOLD: 0,
    SILVER: 0,
    BRONZE: 0,
    RISING: 0,
  };
  for (const badge of badges) countsByTier[badge.tier]++;

  const bestScores = attempted
    .map((row) => row._max.scorePercent)
    .filter((score): score is number => score !== null);

  const averageScore =
    bestScores.length === 0
      ? null
      : Math.round(bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length);

  return {
    badges: badges.map((b) => ({
      quizId: b.quizId,
      quizSlug: b.quiz.slug,
      quizTitle: b.quiz.title,
      tier: b.tier,
      scorePercent: b.scorePercent,
      earnedAt: b.earnedAt,
    })),
    totalBadges: badges.length,
    totalQuizzes,
    quizzesAttempted: attempted.length,
    averageScore,
    countsByTier,
  };
}

/** Sorts by rank then score, so ties break on the better result. */
export function compareBadges(
  a: { tier: BadgeTier; scorePercent: number },
  b: { tier: BadgeTier; scorePercent: number },
): number {
  return TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.scorePercent - a.scorePercent;
}

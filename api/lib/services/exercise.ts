import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { ExerciseCategory, ExerciseIntensity } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { round, touchParticipantActivity, TRUNC_UNIT, type TrendInterval } from "@/lib/services/shared";

/** Exercise sessions logged by participants, plus the activity catalogue. */

const LOG_SELECT = {
  id: true,
  exerciseId: true,
  programId: true,
  activityName: true,
  category: true,
  durationMinutes: true,
  intensity: true,
  caloriesBurned: true,
  distanceKm: true,
  steps: true,
  performedAt: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.ExerciseLogSelect;

export async function listExerciseLogs(params: {
  userId: string;
  from: Date;
  to: Date;
  category?: ExerciseCategory;
  intensity?: ExerciseIntensity;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}) {
  const where: Prisma.ExerciseLogWhereInput = {
    userId: params.userId,
    performedAt: { gte: params.from, lte: params.to },
    ...(params.category ? { category: params.category } : {}),
    ...(params.intensity ? { intensity: params.intensity } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.exerciseLog.findMany({
      where,
      select: LOG_SELECT,
      orderBy: { performedAt: params.sortOrder },
      skip: params.skip,
      take: params.take,
    }),
    prisma.exerciseLog.count({ where }),
  ]);

  return { items, total };
}

export async function getExerciseLog(id: string) {
  const log = await prisma.exerciseLog.findUnique({
    where: { id },
    select: { ...LOG_SELECT, userId: true },
  });
  if (!log) throw new NotFoundError("Exercise record");
  return log;
}

export async function createExerciseLog(
  userId: string,
  input: Omit<Prisma.ExerciseLogUncheckedCreateInput, "userId" | "id">,
) {
  const log = await prisma.exerciseLog.create({
    data: { ...input, userId },
    select: LOG_SELECT,
  });
  await touchParticipantActivity(userId);
  return log;
}

export async function updateExerciseLog(id: string, input: Prisma.ExerciseLogUpdateInput) {
  return prisma.exerciseLog.update({ where: { id }, data: input, select: LOG_SELECT });
}

export async function deleteExerciseLog(id: string): Promise<void> {
  await prisma.exerciseLog.delete({ where: { id } });
}

/** The shared activity catalogue plus this participant's own additions. */
export async function listExerciseCatalogue(userId: string) {
  return prisma.exercise.findMany({
    where: {
      isActive: true,
      OR: [{ isSystem: true }, { createdById: userId }],
    },
    select: {
      id: true,
      name: true,
      category: true,
      metValue: true,
      description: true,
      isSystem: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export interface ExerciseSummary {
  sessionCount: number;
  totalMinutes: number;
  averageMinutesPerSession: number | null;
  averageMinutesPerWeek: number | null;
  activeDays: number;
  periodDays: number;
  totalDistanceKm: number | null;
  totalSteps: number | null;
  byCategory: Array<{ category: ExerciseCategory; sessions: number; minutes: number }>;
  byIntensity: Array<{ intensity: ExerciseIntensity; sessions: number; minutes: number }>;
}

export async function getExerciseSummary(params: {
  userId?: string;
  userIds?: string[];
  from: Date;
  to: Date;
}): Promise<ExerciseSummary> {
  const empty: ExerciseSummary = {
    sessionCount: 0,
    totalMinutes: 0,
    averageMinutesPerSession: null,
    averageMinutesPerWeek: null,
    activeDays: 0,
    periodDays: 0,
    totalDistanceKm: null,
    totalSteps: null,
    byCategory: [],
    byIntensity: [],
  };

  if (params.userIds && params.userIds.length === 0) return empty;

  const where: Prisma.ExerciseLogWhereInput = {
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.userIds ? { userId: { in: params.userIds } } : {}),
    performedAt: { gte: params.from, lte: params.to },
  };

  const scope = params.userId
    ? Prisma.sql`AND "userId" = ${params.userId}`
    : params.userIds
      ? Prisma.sql`AND "userId" IN (${Prisma.join(params.userIds)})`
      : Prisma.empty;

  const [totals, byCategory, byIntensity, dayRows] = await Promise.all([
    prisma.exerciseLog.aggregate({
      where,
      _count: { _all: true },
      _sum: { durationMinutes: true, distanceKm: true, steps: true },
      _avg: { durationMinutes: true },
    }),
    prisma.exerciseLog.groupBy({
      by: ["category"],
      where,
      _count: { _all: true },
      _sum: { durationMinutes: true },
    }),
    prisma.exerciseLog.groupBy({
      by: ["intensity"],
      where,
      _count: { _all: true },
      _sum: { durationMinutes: true },
    }),
    prisma.$queryRaw<Array<{ days: bigint }>>`
      SELECT COUNT(DISTINCT DATE("performedAt"))::bigint AS days
      FROM "ExerciseLog"
      WHERE "performedAt" >= ${params.from}
        AND "performedAt" <= ${params.to}
        ${scope}
    `,
  ]);

  const periodDays = Math.max(
    1,
    Math.round((params.to.getTime() - params.from.getTime()) / 86_400_000),
  );
  const totalMinutes = totals._sum.durationMinutes ?? 0;

  return {
    sessionCount: totals._count._all,
    totalMinutes,
    averageMinutesPerSession: round(totals._avg.durationMinutes, 1),
    averageMinutesPerWeek:
      totalMinutes > 0 ? round((totalMinutes / periodDays) * 7, 1) : null,
    activeDays: Number(dayRows[0]?.days ?? 0),
    periodDays,
    totalDistanceKm: round(totals._sum.distanceKm, 2),
    totalSteps: totals._sum.steps ?? null,
    byCategory: byCategory.map((row) => ({
      category: row.category,
      sessions: row._count._all,
      minutes: row._sum.durationMinutes ?? 0,
    })),
    byIntensity: byIntensity.map((row) => ({
      intensity: row.intensity,
      sessions: row._count._all,
      minutes: row._sum.durationMinutes ?? 0,
    })),
  };
}

export async function getExerciseTrend(params: {
  userId?: string;
  userIds?: string[];
  from: Date;
  to: Date;
  interval: TrendInterval;
}) {
  if (params.userIds && params.userIds.length === 0) return [];

  const truncUnit = Prisma.raw(`'${TRUNC_UNIT[params.interval]}'`);
  const scope = params.userId
    ? Prisma.sql`AND "userId" = ${params.userId}`
    : params.userIds
      ? Prisma.sql`AND "userId" IN (${Prisma.join(params.userIds)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; sessions: bigint; minutes: bigint | null }>
  >`
    SELECT
      DATE_TRUNC(${truncUnit}, "performedAt") AS bucket,
      COUNT(*)::bigint                        AS sessions,
      SUM("durationMinutes")::bigint          AS minutes
    FROM "ExerciseLog"
    WHERE "performedAt" >= ${params.from}
      AND "performedAt" <= ${params.to}
      ${scope}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    sessions: Number(row.sessions),
    minutes: Number(row.minutes ?? 0),
  }));
}

/**
 * Minutes per weekday across the period, for the "Weekly Exercise" bar chart.
 * `dow` follows Postgres: 0 = Sunday.
 */
export async function getWeekdayDistribution(params: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<Array<{ weekday: number; sessions: number; minutes: number }>> {
  const rows = await prisma.$queryRaw<
    Array<{ dow: number; sessions: bigint; minutes: bigint | null }>
  >`
    SELECT
      EXTRACT(DOW FROM "performedAt")::int AS dow,
      COUNT(*)::bigint                     AS sessions,
      SUM("durationMinutes")::bigint       AS minutes
    FROM "ExerciseLog"
    WHERE "userId" = ${params.userId}
      AND "performedAt" >= ${params.from}
      AND "performedAt" <= ${params.to}
    GROUP BY dow
    ORDER BY dow ASC
  `;

  const byDay = new Map(
    rows.map((row) => [row.dow, { sessions: Number(row.sessions), minutes: Number(row.minutes ?? 0) }]),
  );

  // Always return all seven days so the chart has a stable x-axis.
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    sessions: byDay.get(weekday)?.sessions ?? 0,
    minutes: byDay.get(weekday)?.minutes ?? 0,
  }));
}

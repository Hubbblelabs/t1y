import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { participantScopeFilter } from "@/lib/permissions/policies";
import { getAggregateGlucoseTrend } from "@/lib/services/glucose";
import { getExerciseSummary, getExerciseTrend } from "@/lib/services/exercise";
import { getRecentHbA1cUpdates } from "@/lib/services/hba1c";
import { getAdherenceSummary } from "@/lib/services/medications";
import { percentChange, previousPeriod, round, type TrendInterval } from "@/lib/services/shared";

/**
 * Platform-level analytics for the administration dashboard.
 *
 * Every figure is computed over the set of participants the caller is allowed
 * to see, so a researcher's dashboard reflects their cohort rather than the
 * whole platform.
 */

/**
 * Resolves the caller's visible participant ids.
 *
 * Returns `null` for unrestricted roles, which lets the callers skip an
 * `IN (…)` clause entirely rather than passing the full id list to Postgres.
 */
async function visibleParticipantIds(principal: Principal): Promise<string[] | null> {
  const scope = await participantScopeFilter(principal);
  if (Object.keys(scope).length === 0) return null;

  const users = await prisma.user.findMany({
    where: { ...scope, role: "PATIENT", deletedAt: null },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export interface DashboardOverview {
  participants: {
    total: number;
    active: number;
    newInPeriod: number;
    newChangePercent: number | null;
    pending: number;
    inactive: number;
  };
  activity: {
    recordsLoggedToday: number;
    recordsLoggedInPeriod: number;
    participantsLoggingToday: number;
  };
  adherence: {
    percent: number | null;
    taken: number;
    missed: number;
    skipped: number;
  };
  exercise: {
    totalMinutes: number;
    averageMinutesPerParticipant: number | null;
    sessionCount: number;
  };
  range: { from: string; to: string };
}

export async function getDashboardOverview(
  principal: Principal,
  range: { from: Date; to: Date },
): Promise<DashboardOverview> {
  const visibleIds = await visibleParticipantIds(principal);
  const scopeFilter: Prisma.UserWhereInput =
    visibleIds === null ? {} : { id: { in: visibleIds } };

  const previous = previousPeriod(range.from, range.to);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    total,
    active,
    pending,
    inactive,
    newInPeriod,
    newInPrevious,
    adherence,
    exercise,
    todayCounts,
    periodCounts,
  ] = await Promise.all([
    prisma.user.count({ where: { ...scopeFilter, role: "PATIENT", deletedAt: null } }),
    prisma.user.count({
      where: { ...scopeFilter, role: "PATIENT", deletedAt: null, status: "ACTIVE" },
    }),
    prisma.user.count({
      where: { ...scopeFilter, role: "PATIENT", deletedAt: null, status: "PENDING" },
    }),
    prisma.user.count({
      where: { ...scopeFilter, role: "PATIENT", deletedAt: null, status: "INACTIVE" },
    }),
    prisma.user.count({
      where: {
        ...scopeFilter,
        role: "PATIENT",
        deletedAt: null,
        createdAt: { gte: range.from, lte: range.to },
      },
    }),
    prisma.user.count({
      where: {
        ...scopeFilter,
        role: "PATIENT",
        deletedAt: null,
        createdAt: { gte: previous.from, lt: previous.to },
      },
    }),
    getAdherenceSummary({
      ...(visibleIds === null ? {} : { userIds: visibleIds }),
      from: range.from,
      to: range.to,
    }),
    getExerciseSummary({
      ...(visibleIds === null ? {} : { userIds: visibleIds }),
      from: range.from,
      to: range.to,
    }),
    countHealthRecords(visibleIds, startOfToday, new Date()),
    countHealthRecords(visibleIds, range.from, range.to),
  ]);

  return {
    participants: {
      total,
      active,
      newInPeriod,
      newChangePercent: percentChange(newInPeriod, newInPrevious),
      pending,
      inactive,
    },
    activity: {
      recordsLoggedToday: todayCounts.total,
      recordsLoggedInPeriod: periodCounts.total,
      participantsLoggingToday: todayCounts.distinctParticipants,
    },
    adherence: {
      percent: adherence.adherencePercent,
      taken: adherence.taken,
      missed: adherence.missed,
      skipped: adherence.skipped,
    },
    exercise: {
      totalMinutes: exercise.totalMinutes,
      averageMinutesPerParticipant:
        active > 0 ? round(exercise.totalMinutes / active, 1) : null,
      sessionCount: exercise.sessionCount,
    },
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
  };
}

/**
 * Counts health records written across all domains in a window.
 *
 * One UNION ALL rather than six round trips; each branch is served by that
 * table's (userId, timestamp) index.
 */
async function countHealthRecords(
  userIds: string[] | null,
  from: Date,
  to: Date,
): Promise<{ total: number; distinctParticipants: number }> {
  if (userIds !== null && userIds.length === 0) {
    return { total: 0, distinctParticipants: 0 };
  }

  const scope = userIds === null ? Prisma.empty : Prisma.sql`AND "userId" = ANY(${userIds})`;

  const rows = await prisma.$queryRaw<Array<{ total: bigint; participants: bigint }>>`
    WITH events AS (
      SELECT "userId" FROM "GlucoseReading"
        WHERE "measuredAt" >= ${from} AND "measuredAt" <= ${to} ${scope}
      UNION ALL
      SELECT "userId" FROM "MedicationLog"
        WHERE COALESCE("scheduledFor", "createdAt") >= ${from}
          AND COALESCE("scheduledFor", "createdAt") <= ${to} ${scope}
      UNION ALL
      SELECT "userId" FROM "InsulinLog"
        WHERE "administeredAt" >= ${from} AND "administeredAt" <= ${to} ${scope}
      UNION ALL
      SELECT "userId" FROM "Meal"
        WHERE "consumedAt" >= ${from} AND "consumedAt" <= ${to} ${scope}
      UNION ALL
      SELECT "userId" FROM "ExerciseLog"
        WHERE "performedAt" >= ${from} AND "performedAt" <= ${to} ${scope}
      UNION ALL
      SELECT "userId" FROM "HbA1cRecord"
        WHERE "measuredAt" >= ${from} AND "measuredAt" <= ${to} ${scope}
      UNION ALL
      SELECT "userId" FROM "HealthMetric"
        WHERE "measuredAt" >= ${from} AND "measuredAt" <= ${to} ${scope}
    )
    SELECT COUNT(*)::bigint AS total, COUNT(DISTINCT "userId")::bigint AS participants
    FROM events
  `;

  return {
    total: Number(rows[0]?.total ?? 0),
    distinctParticipants: Number(rows[0]?.participants ?? 0),
  };
}

export async function getDashboardCharts(
  principal: Principal,
  range: { from: Date; to: Date },
  interval: TrendInterval,
) {
  const visibleIds = await visibleParticipantIds(principal);

  const [glucoseSeries, exerciseSeries, recentHbA1c, recentActivity] = await Promise.all([
    getAggregateGlucoseTrend({
      ...(visibleIds === null ? {} : { userIds: visibleIds }),
      from: range.from,
      to: range.to,
      interval,
      unit: "MG_DL",
    }),
    getExerciseTrend({
      ...(visibleIds === null ? {} : { userIds: visibleIds }),
      from: range.from,
      to: range.to,
      interval,
    }),
    getRecentHbA1cUpdates({
      ...(visibleIds === null ? {} : { userIds: visibleIds }),
      limit: 8,
    }),
    getRecentActivity(visibleIds, 12),
  ]);

  return { glucoseSeries, exerciseSeries, recentHbA1c, recentActivity };
}

export interface ActivityEntry {
  id: string;
  kind: string;
  occurredAt: Date;
  participantCode: string;
  participantName: string;
  summary: string;
}

/**
 * Latest logging events across the visible cohort, for the dashboard's
 * "Recent activity" panel.
 */
export async function getRecentActivity(
  userIds: string[] | null,
  limit: number,
): Promise<ActivityEntry[]> {
  if (userIds !== null && userIds.length === 0) return [];

  const scope: Prisma.UserWhereInput =
    userIds === null ? {} : { id: { in: userIds } };

  const [glucose, exercise, hba1c, meals] = await Promise.all([
    prisma.glucoseReading.findMany({
      where: { user: scope },
      orderBy: { measuredAt: "desc" },
      take: limit,
      select: {
        id: true,
        value: true,
        unit: true,
        measuredAt: true,
        user: { select: { id: true, profile: { select: participantNameSelect } } },
      },
    }),
    prisma.exerciseLog.findMany({
      where: { user: scope },
      orderBy: { performedAt: "desc" },
      take: limit,
      select: {
        id: true,
        activityName: true,
        durationMinutes: true,
        performedAt: true,
        user: { select: { id: true, profile: { select: participantNameSelect } } },
      },
    }),
    prisma.hbA1cRecord.findMany({
      where: { user: scope },
      orderBy: { measuredAt: "desc" },
      take: limit,
      select: {
        id: true,
        valuePercent: true,
        measuredAt: true,
        user: { select: { id: true, profile: { select: participantNameSelect } } },
      },
    }),
    prisma.meal.findMany({
      where: { user: scope },
      orderBy: { consumedAt: "desc" },
      take: limit,
      select: {
        id: true,
        mealType: true,
        consumedAt: true,
        user: { select: { id: true, profile: { select: participantNameSelect } } },
      },
    }),
  ]);

  const name = (profile: { firstName: string; lastName: string } | null) =>
    profile ? `${profile.firstName} ${profile.lastName}` : "Unknown participant";
  const code = (profile: { participantCode: string } | null) =>
    profile?.participantCode ?? "—";

  const entries: ActivityEntry[] = [
    ...glucose.map((row) => ({
      id: `glucose:${row.id}`,
      kind: "Glucose",
      occurredAt: row.measuredAt,
      participantCode: code(row.user.profile),
      participantName: name(row.user.profile),
      summary: `${row.value} ${row.unit === "MG_DL" ? "mg/dL" : "mmol/L"}`,
    })),
    ...exercise.map((row) => ({
      id: `exercise:${row.id}`,
      kind: "Exercise",
      occurredAt: row.performedAt,
      participantCode: code(row.user.profile),
      participantName: name(row.user.profile),
      summary: `${row.activityName} · ${row.durationMinutes} min`,
    })),
    ...hba1c.map((row) => ({
      id: `hba1c:${row.id}`,
      kind: "HbA1c",
      occurredAt: row.measuredAt,
      participantCode: code(row.user.profile),
      participantName: name(row.user.profile),
      summary: `${row.valuePercent}%`,
    })),
    ...meals.map((row) => ({
      id: `meal:${row.id}`,
      kind: "Meal",
      occurredAt: row.consumedAt,
      participantCode: code(row.user.profile),
      participantName: name(row.user.profile),
      summary: row.mealType.charAt(0) + row.mealType.slice(1).toLowerCase(),
    })),
  ];

  return entries
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);
}

const participantNameSelect = {
  participantCode: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.ProfileSelect;

/** Distribution counts used by the reports module. */
export async function getCohortBreakdown(principal: Principal) {
  const scope = await participantScopeFilter(principal);
  const base: Prisma.ProfileWhereInput = {
    user: { ...scope, role: "PATIENT", deletedAt: null },
  };

  const [byDiabetesType, byTreatment, byStatus] = await Promise.all([
    prisma.profile.groupBy({
      by: ["diabetesType"],
      where: base,
      _count: { _all: true },
    }),
    prisma.profile.groupBy({
      by: ["treatmentModality"],
      where: base,
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["status"],
      where: { ...scope, role: "PATIENT", deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  return {
    byDiabetesType: byDiabetesType.map((row) => ({
      key: row.diabetesType,
      count: row._count._all,
    })),
    byTreatmentModality: byTreatment.map((row) => ({
      key: row.treatmentModality,
      count: row._count._all,
    })),
    byStatus: byStatus.map((row) => ({ key: row.status, count: row._count._all })),
  };
}

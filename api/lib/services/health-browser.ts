import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { participantScopeFilter } from "@/lib/permissions/policies";

/**
 * Cross-participant record browsing for the "Health data" section.
 *
 * Each domain is a separate function rather than one generic query builder:
 * the columns, ordering and joins genuinely differ, and a generic version
 * would obscure which fields each one exposes — worth being explicit about
 * when the rows are health records.
 *
 * Every query is filtered by `participantScopeFilter`, so a researcher only
 * ever sees rows belonging to participants in their studies.
 */

export interface BrowseParams {
  from: Date;
  to: Date;
  search?: string;
  skip: number;
  take: number;
}

/** Restricts a health-table query to the participants the caller may see. */
async function scopedUserFilter(
  principal: Principal,
  search?: string,
): Promise<Prisma.UserWhereInput> {
  const scope = await participantScopeFilter(principal);

  return {
    ...scope,
    role: "PATIENT",
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { profile: { participantCode: { contains: search, mode: "insensitive" } } },
            { profile: { firstName: { contains: search, mode: "insensitive" } } },
            { profile: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

const participantSelect = {
  id: true,
  profile: { select: { participantCode: true, firstName: true, lastName: true } },
} satisfies Prisma.UserSelect;

export async function browseGlucose(principal: Principal, params: BrowseParams) {
  const user = await scopedUserFilter(principal, params.search);
  const where: Prisma.GlucoseReadingWhereInput = {
    user,
    measuredAt: { gte: params.from, lte: params.to },
  };

  const [items, total] = await Promise.all([
    prisma.glucoseReading.findMany({
      where,
      orderBy: { measuredAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        value: true,
        unit: true,
        context: true,
        measuredAt: true,
        source: true,
        user: { select: participantSelect },
      },
    }),
    prisma.glucoseReading.count({ where }),
  ]);

  return { items, total };
}

export async function browseMedicationLogs(principal: Principal, params: BrowseParams) {
  const user = await scopedUserFilter(principal, params.search);
  const where: Prisma.MedicationLogWhereInput = {
    user,
    OR: [
      { scheduledFor: { gte: params.from, lte: params.to } },
      { scheduledFor: null, createdAt: { gte: params.from, lte: params.to } },
    ],
  };

  const [items, total] = await Promise.all([
    prisma.medicationLog.findMany({
      where,
      orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        status: true,
        scheduledFor: true,
        takenAt: true,
        createdAt: true,
        medication: { select: { name: true, dosageText: true } },
        user: { select: participantSelect },
      },
    }),
    prisma.medicationLog.count({ where }),
  ]);

  return { items, total };
}

export async function browseInsulin(principal: Principal, params: BrowseParams) {
  const user = await scopedUserFilter(principal, params.search);
  const where: Prisma.InsulinLogWhereInput = {
    user,
    administeredAt: { gte: params.from, lte: params.to },
  };

  const [items, total] = await Promise.all([
    prisma.insulinLog.findMany({
      where,
      orderBy: { administeredAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        insulinName: true,
        insulinType: true,
        doseUnits: true,
        unit: true,
        administeredAt: true,
        injectionSite: true,
        mealAssociation: true,
        notes: true,
        user: { select: participantSelect },
      },
    }),
    prisma.insulinLog.count({ where }),
  ]);

  return { items, total };
}

export async function browseMeals(principal: Principal, params: BrowseParams) {
  const user = await scopedUserFilter(principal, params.search);
  const where: Prisma.MealWhereInput = {
    user,
    consumedAt: { gte: params.from, lte: params.to },
  };

  const [items, total] = await Promise.all([
    prisma.meal.findMany({
      where,
      orderBy: { consumedAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        name: true,
        mealType: true,
        consumedAt: true,
        totalCarbsGrams: true,
        totalCalories: true,
        nutritionSource: true,
        user: { select: participantSelect },
      },
    }),
    prisma.meal.count({ where }),
  ]);

  return { items, total };
}

export async function browseExercise(principal: Principal, params: BrowseParams) {
  const user = await scopedUserFilter(principal, params.search);
  const where: Prisma.ExerciseLogWhereInput = {
    user,
    performedAt: { gte: params.from, lte: params.to },
  };

  const [items, total] = await Promise.all([
    prisma.exerciseLog.findMany({
      where,
      orderBy: { performedAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        activityName: true,
        category: true,
        durationMinutes: true,
        intensity: true,
        distanceKm: true,
        performedAt: true,
        user: { select: participantSelect },
      },
    }),
    prisma.exerciseLog.count({ where }),
  ]);

  return { items, total };
}

export async function browseHbA1c(principal: Principal, params: BrowseParams) {
  const user = await scopedUserFilter(principal, params.search);
  const where: Prisma.HbA1cRecordWhereInput = {
    user,
    measuredAt: { gte: params.from, lte: params.to },
  };

  const [items, total] = await Promise.all([
    prisma.hbA1cRecord.findMany({
      where,
      orderBy: { measuredAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        valuePercent: true,
        valueMmolMol: true,
        measuredAt: true,
        source: true,
        laboratoryName: true,
        user: { select: participantSelect },
      },
    }),
    prisma.hbA1cRecord.count({ where }),
  ]);

  return { items, total };
}

export async function browseHealthMetrics(principal: Principal, params: BrowseParams) {
  const user = await scopedUserFilter(principal, params.search);
  const where: Prisma.HealthMetricWhereInput = {
    user,
    measuredAt: { gte: params.from, lte: params.to },
  };

  const [items, total] = await Promise.all([
    prisma.healthMetric.findMany({
      where,
      orderBy: { measuredAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        value: true,
        secondaryValue: true,
        unit: true,
        measuredAt: true,
        definition: { select: { label: true, valueType: true, secondaryLabel: true } },
        user: { select: participantSelect },
      },
    }),
    prisma.healthMetric.count({ where }),
  ]);

  return { items, total };
}

/** Formats the participant column consistently across every browse table. */
export function participantLabel(user: {
  profile: { participantCode: string; firstName: string; lastName: string } | null;
}): { code: string; name: string } {
  return {
    code: user.profile?.participantCode ?? "—",
    name: user.profile
      ? `${user.profile.firstName} ${user.profile.lastName}`
      : "Unknown participant",
  };
}

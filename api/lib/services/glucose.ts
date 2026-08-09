import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { GlucoseContext, GlucoseUnit } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import {
  daysBetween,
  glucoseFromMgDl,
  glucoseToMgDl,
  previousPeriod,
  round,
  touchParticipantActivity,
  TRUNC_UNIT,
  trendDirection,
  type TrendDirection,
  type TrendInterval,
} from "@/lib/services/shared";

/**
 * Glucose records and analytics.
 *
 * Readings may be stored in either unit. Every aggregate is computed in mg/dL
 * and converted once at the end, so a participant who switched units mid-study
 * still produces a coherent average.
 *
 * Nothing here classifies a reading as high, low, in-range or out-of-range.
 * That judgement requires a configured `ClinicalThreshold` and is applied by
 * the threshold service, not by this module.
 */

export interface GlucoseListFilters {
  userId: string;
  from: Date;
  to: Date;
  context?: GlucoseContext;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}

const READING_SELECT = {
  id: true,
  value: true,
  unit: true,
  context: true,
  measuredAt: true,
  source: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.GlucoseReadingSelect;

export async function listGlucoseReadings(filters: GlucoseListFilters) {
  const where: Prisma.GlucoseReadingWhereInput = {
    userId: filters.userId,
    measuredAt: { gte: filters.from, lte: filters.to },
    ...(filters.context ? { context: filters.context } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.glucoseReading.findMany({
      where,
      select: READING_SELECT,
      orderBy: { measuredAt: filters.sortOrder },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.glucoseReading.count({ where }),
  ]);

  return { items, total };
}

export async function getGlucoseReading(id: string) {
  const reading = await prisma.glucoseReading.findUnique({
    where: { id },
    select: { ...READING_SELECT, userId: true },
  });
  if (!reading) throw new NotFoundError("Glucose reading");
  return reading;
}

export interface CreateGlucoseInput {
  value: number;
  unit: GlucoseUnit;
  context: GlucoseContext;
  measuredAt: Date;
  source: "MANUAL" | "DEVICE" | "IMPORT" | "CLINICIAN";
  deviceId?: string;
  notes?: string;
}

export async function createGlucoseReading(userId: string, input: CreateGlucoseInput) {
  const reading = await prisma.glucoseReading.create({
    data: { userId, ...input },
    select: READING_SELECT,
  });
  await touchParticipantActivity(userId);
  return reading;
}

export async function updateGlucoseReading(
  id: string,
  input: Partial<CreateGlucoseInput>,
) {
  return prisma.glucoseReading.update({
    where: { id },
    data: input,
    select: READING_SELECT,
  });
}

export async function deleteGlucoseReading(id: string): Promise<void> {
  await prisma.glucoseReading.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface GlucoseSummary {
  unit: GlucoseUnit;
  count: number;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
  standardDeviation: number | null;
  /** Mean readings recorded per day across the period. */
  readingsPerDay: number | null;
  /** Days in the period on which at least one reading exists. */
  daysWithReadings: number;
  periodDays: number;
  previousAverage: number | null;
  trend: TrendDirection;
  contextDistribution: Array<{ context: GlucoseContext; count: number; average: number | null }>;
}

interface AggregateRow {
  count: bigint;
  avg: number | null;
  min: number | null;
  max: number | null;
  stddev: number | null;
  days_with_readings: bigint;
}

/**
 * Converts every reading to mg/dL inside SQL, so mixed-unit histories aggregate
 * correctly without loading rows into the application.
 */
const VALUE_IN_MGDL = Prisma.sql`
  CASE WHEN "unit" = 'MMOL_L' THEN "value" * 18.0182 ELSE "value" END
`;

export async function getGlucoseSummary(params: {
  userId: string;
  from: Date;
  to: Date;
  unit: GlucoseUnit;
  context?: GlucoseContext;
}): Promise<GlucoseSummary> {
  const contextFilter = params.context
    ? Prisma.sql`AND "context"::text = ${params.context}`
    : Prisma.empty;

  const previous = previousPeriod(params.from, params.to);

  const [current, priorRows, distribution] = await Promise.all([
    prisma.$queryRaw<AggregateRow[]>`
      SELECT
        COUNT(*)::bigint                                    AS count,
        AVG(${VALUE_IN_MGDL})                               AS avg,
        MIN(${VALUE_IN_MGDL})                               AS min,
        MAX(${VALUE_IN_MGDL})                               AS max,
        STDDEV_SAMP(${VALUE_IN_MGDL})                       AS stddev,
        COUNT(DISTINCT DATE("measuredAt"))::bigint          AS days_with_readings
      FROM "GlucoseReading"
      WHERE "userId" = ${params.userId}
        AND "measuredAt" >= ${params.from}
        AND "measuredAt" <= ${params.to}
        ${contextFilter}
    `,
    prisma.$queryRaw<Array<{ avg: number | null }>>`
      SELECT AVG(${VALUE_IN_MGDL}) AS avg
      FROM "GlucoseReading"
      WHERE "userId" = ${params.userId}
        AND "measuredAt" >= ${previous.from}
        AND "measuredAt" < ${previous.to}
        ${contextFilter}
    `,
    prisma.$queryRaw<Array<{ context: GlucoseContext; count: bigint; avg: number | null }>>`
      SELECT "context", COUNT(*)::bigint AS count, AVG(${VALUE_IN_MGDL}) AS avg
      FROM "GlucoseReading"
      WHERE "userId" = ${params.userId}
        AND "measuredAt" >= ${params.from}
        AND "measuredAt" <= ${params.to}
      GROUP BY "context"
      ORDER BY count DESC
    `,
  ]);

  const row = current[0];
  const count = Number(row?.count ?? 0);
  const periodDays = daysBetween(params.from, params.to);

  const toUnit = (value: number | null | undefined) =>
    value === null || value === undefined
      ? null
      : round(glucoseFromMgDl(value, params.unit), params.unit === "MG_DL" ? 1 : 2);

  const average = toUnit(row?.avg);
  const previousAverage = toUnit(priorRows[0]?.avg);

  return {
    unit: params.unit,
    count,
    average,
    minimum: toUnit(row?.min),
    maximum: toUnit(row?.max),
    standardDeviation: toUnit(row?.stddev),
    readingsPerDay: count > 0 ? round(count / periodDays, 2) : null,
    daysWithReadings: Number(row?.days_with_readings ?? 0),
    periodDays,
    previousAverage,
    trend: trendDirection(average, previousAverage),
    contextDistribution: distribution.map((entry) => ({
      context: entry.context,
      count: Number(entry.count),
      average: toUnit(entry.avg),
    })),
  };
}

export interface GlucoseTrendPoint {
  bucket: string;
  count: number;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
}

export async function getGlucoseTrend(params: {
  userId: string;
  from: Date;
  to: Date;
  interval: TrendInterval;
  unit: GlucoseUnit;
  context?: GlucoseContext;
}): Promise<GlucoseTrendPoint[]> {
  // Looked up from a fixed map — never interpolated from user input.
  const unit = Prisma.raw(`'${TRUNC_UNIT[params.interval]}'`);
  const contextFilter = params.context
    ? Prisma.sql`AND "context"::text = ${params.context}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; count: bigint; avg: number | null; min: number | null; max: number | null }>
  >`
    SELECT
      DATE_TRUNC(${unit}, "measuredAt") AS bucket,
      COUNT(*)::bigint                  AS count,
      AVG(${VALUE_IN_MGDL})             AS avg,
      MIN(${VALUE_IN_MGDL})             AS min,
      MAX(${VALUE_IN_MGDL})             AS max
    FROM "GlucoseReading"
    WHERE "userId" = ${params.userId}
      AND "measuredAt" >= ${params.from}
      AND "measuredAt" <= ${params.to}
      ${contextFilter}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  const decimals = params.unit === "MG_DL" ? 1 : 2;
  return rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    count: Number(row.count),
    average: row.avg === null ? null : round(glucoseFromMgDl(row.avg, params.unit), decimals),
    minimum: row.min === null ? null : round(glucoseFromMgDl(row.min, params.unit), decimals),
    maximum: row.max === null ? null : round(glucoseFromMgDl(row.max, params.unit), decimals),
  }));
}

/**
 * Platform-wide daily average, used by the admin dashboard's glucose chart.
 * Scoped to a set of participants so researcher access stays restricted.
 */
export async function getAggregateGlucoseTrend(params: {
  userIds?: string[];
  from: Date;
  to: Date;
  interval: TrendInterval;
  unit: GlucoseUnit;
}): Promise<GlucoseTrendPoint[]> {
  if (params.userIds && params.userIds.length === 0) return [];

  const unit = Prisma.raw(`'${TRUNC_UNIT[params.interval]}'`);
  const scope = params.userIds
    ? Prisma.sql`AND "userId" IN (${Prisma.join(params.userIds)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; count: bigint; avg: number | null; min: number | null; max: number | null }>
  >`
    SELECT
      DATE_TRUNC(${unit}, "measuredAt") AS bucket,
      COUNT(*)::bigint                  AS count,
      AVG(${VALUE_IN_MGDL})             AS avg,
      MIN(${VALUE_IN_MGDL})             AS min,
      MAX(${VALUE_IN_MGDL})             AS max
    FROM "GlucoseReading"
    WHERE "measuredAt" >= ${params.from}
      AND "measuredAt" <= ${params.to}
      ${scope}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  const decimals = params.unit === "MG_DL" ? 1 : 2;
  return rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    count: Number(row.count),
    average: row.avg === null ? null : round(glucoseFromMgDl(row.avg, params.unit), decimals),
    minimum: row.min === null ? null : round(glucoseFromMgDl(row.min, params.unit), decimals),
    maximum: row.max === null ? null : round(glucoseFromMgDl(row.max, params.unit), decimals),
  }));
}

/** Most recent reading, normalised to the requested unit. */
export async function getLatestGlucose(userId: string, unit: GlucoseUnit = "MG_DL") {
  const reading = await prisma.glucoseReading.findFirst({
    where: { userId },
    orderBy: { measuredAt: "desc" },
    select: READING_SELECT,
  });
  if (!reading) return null;

  const mgdl = glucoseToMgDl(reading.value, reading.unit);
  return {
    ...reading,
    normalisedValue: round(glucoseFromMgDl(mgdl, unit), unit === "MG_DL" ? 1 : 2),
    normalisedUnit: unit,
  };
}

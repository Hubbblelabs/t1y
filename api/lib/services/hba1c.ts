import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import {
  hba1cPercentToMmolMol,
  round,
  touchParticipantActivity,
} from "@/lib/services/shared";

/**
 * HbA1c records.
 *
 * The service reports the latest value, the previous one and the arithmetic
 * change between them. It does not label a result as good, poor, controlled or
 * uncontrolled — that classification depends on a configured clinical
 * threshold and on the individual's care plan.
 */

const HBA1C_SELECT = {
  id: true,
  valuePercent: true,
  valueMmolMol: true,
  measuredAt: true,
  source: true,
  laboratoryName: true,
  orderedBy: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.HbA1cRecordSelect;

export async function listHbA1cRecords(params: {
  userId: string;
  from: Date;
  to: Date;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}) {
  const where: Prisma.HbA1cRecordWhereInput = {
    userId: params.userId,
    measuredAt: { gte: params.from, lte: params.to },
  };

  const [items, total] = await Promise.all([
    prisma.hbA1cRecord.findMany({
      where,
      select: HBA1C_SELECT,
      orderBy: { measuredAt: params.sortOrder },
      skip: params.skip,
      take: params.take,
    }),
    prisma.hbA1cRecord.count({ where }),
  ]);

  return { items, total };
}

export async function getHbA1cRecord(id: string) {
  const record = await prisma.hbA1cRecord.findUnique({
    where: { id },
    select: { ...HBA1C_SELECT, userId: true },
  });
  if (!record) throw new NotFoundError("HbA1c record");
  return record;
}

export interface CreateHbA1cInput {
  valuePercent: number;
  valueMmolMol?: number;
  measuredAt: Date;
  source: "LABORATORY" | "POINT_OF_CARE" | "SELF_REPORTED";
  laboratoryName?: string;
  orderedBy?: string;
  notes?: string;
}

export async function createHbA1cRecord(userId: string, input: CreateHbA1cInput) {
  const record = await prisma.hbA1cRecord.create({
    data: {
      userId,
      ...input,
      // Derive IFCC units when the laboratory did not report them.
      valueMmolMol: input.valueMmolMol ?? round(hba1cPercentToMmolMol(input.valuePercent), 1)!,
    },
    select: HBA1C_SELECT,
  });
  await touchParticipantActivity(userId);
  return record;
}

export async function updateHbA1cRecord(id: string, input: Partial<CreateHbA1cInput>) {
  return prisma.hbA1cRecord.update({
    where: { id },
    data: {
      ...input,
      ...(input.valuePercent !== undefined && input.valueMmolMol === undefined
        ? { valueMmolMol: round(hba1cPercentToMmolMol(input.valuePercent), 1) }
        : {}),
    },
    select: HBA1C_SELECT,
  });
}

export async function deleteHbA1cRecord(id: string): Promise<void> {
  await prisma.hbA1cRecord.delete({ where: { id } });
}

export interface HbA1cSummary {
  latest: { valuePercent: number; valueMmolMol: number | null; measuredAt: Date } | null;
  previous: { valuePercent: number; measuredAt: Date } | null;
  /** Arithmetic difference in percentage points; negative means a decrease. */
  changePercentagePoints: number | null;
  /** Days between the two most recent measurements. */
  daysBetweenLastTwo: number | null;
  recordCount: number;
  averagePercent: number | null;
  history: Array<{ valuePercent: number; measuredAt: string }>;
}

export async function getHbA1cSummary(params: {
  userId: string;
  from?: Date;
  to?: Date;
  historyLimit?: number;
}): Promise<HbA1cSummary> {
  const range =
    params.from && params.to
      ? { measuredAt: { gte: params.from, lte: params.to } }
      : {};

  const [recent, aggregate, history] = await Promise.all([
    prisma.hbA1cRecord.findMany({
      where: { userId: params.userId },
      orderBy: { measuredAt: "desc" },
      take: 2,
      select: { valuePercent: true, valueMmolMol: true, measuredAt: true },
    }),
    prisma.hbA1cRecord.aggregate({
      where: { userId: params.userId, ...range },
      _count: { _all: true },
      _avg: { valuePercent: true },
    }),
    prisma.hbA1cRecord.findMany({
      where: { userId: params.userId, ...range },
      orderBy: { measuredAt: "asc" },
      take: params.historyLimit ?? 50,
      select: { valuePercent: true, measuredAt: true },
    }),
  ]);

  const latest = recent[0] ?? null;
  const previous = recent[1] ?? null;

  return {
    latest: latest
      ? {
          valuePercent: latest.valuePercent,
          valueMmolMol: latest.valueMmolMol,
          measuredAt: latest.measuredAt,
        }
      : null,
    previous: previous
      ? { valuePercent: previous.valuePercent, measuredAt: previous.measuredAt }
      : null,
    changePercentagePoints:
      latest && previous ? round(latest.valuePercent - previous.valuePercent, 2) : null,
    daysBetweenLastTwo:
      latest && previous
        ? Math.round(
            (latest.measuredAt.getTime() - previous.measuredAt.getTime()) / 86_400_000,
          )
        : null,
    recordCount: aggregate._count._all,
    averagePercent: round(aggregate._avg.valuePercent, 2),
    history: history.map((row) => ({
      valuePercent: row.valuePercent,
      measuredAt: row.measuredAt.toISOString(),
    })),
  };
}

/** Latest HbA1c for many participants, for the participant table. */
export async function getLatestHbA1cForParticipants(
  userIds: string[],
): Promise<Map<string, { valuePercent: number; measuredAt: Date }>> {
  if (userIds.length === 0) return new Map();

  // DISTINCT ON returns the newest row per participant in a single scan of the
  // (userId, measuredAt) index.
  const rows = await prisma.$queryRaw<
    Array<{ userId: string; valuePercent: number; measuredAt: Date }>
  >`
    SELECT DISTINCT ON ("userId") "userId", "valuePercent", "measuredAt"
    FROM "HbA1cRecord"
    WHERE "userId" = ANY(${userIds})
    ORDER BY "userId", "measuredAt" DESC
  `;

  return new Map(
    rows.map((row) => [
      row.userId,
      { valuePercent: row.valuePercent, measuredAt: row.measuredAt },
    ]),
  );
}

/** Most recently updated HbA1c results across the platform, for the dashboard. */
export async function getRecentHbA1cUpdates(params: {
  userIds?: string[];
  limit: number;
}) {
  if (params.userIds && params.userIds.length === 0) return [];

  return prisma.hbA1cRecord.findMany({
    where: params.userIds ? { userId: { in: params.userIds } } : {},
    orderBy: { measuredAt: "desc" },
    take: params.limit,
    select: {
      id: true,
      valuePercent: true,
      measuredAt: true,
      user: {
        select: {
          id: true,
          profile: { select: { participantCode: true, firstName: true, lastName: true } },
        },
      },
    },
  });
}

import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { InsulinType } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { round, touchParticipantActivity } from "@/lib/services/shared";

/**
 * Insulin administration records.
 *
 * This module reads and writes what a participant reports having administered.
 * It contains no dose calculation, no correction factors and no
 * recommendations — by design. Any such feature would be a clinical decision
 * the platform is explicitly not permitted to make.
 */

const INSULIN_SELECT = {
  id: true,
  insulinName: true,
  insulinType: true,
  doseUnits: true,
  unit: true,
  administeredAt: true,
  injectionSite: true,
  mealAssociation: true,
  mealId: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.InsulinLogSelect;

export async function listInsulinLogs(params: {
  userId: string;
  from: Date;
  to: Date;
  insulinType?: InsulinType;
  sortOrder: "asc" | "desc";
  skip: number;
  take: number;
}) {
  const where: Prisma.InsulinLogWhereInput = {
    userId: params.userId,
    administeredAt: { gte: params.from, lte: params.to },
    ...(params.insulinType ? { insulinType: params.insulinType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.insulinLog.findMany({
      where,
      select: INSULIN_SELECT,
      orderBy: { administeredAt: params.sortOrder },
      skip: params.skip,
      take: params.take,
    }),
    prisma.insulinLog.count({ where }),
  ]);

  return { items, total };
}

export async function getInsulinLog(id: string) {
  const log = await prisma.insulinLog.findUnique({
    where: { id },
    select: { ...INSULIN_SELECT, userId: true },
  });
  if (!log) throw new NotFoundError("Insulin record");
  return log;
}

export async function createInsulinLog(
  userId: string,
  input: Omit<Prisma.InsulinLogUncheckedCreateInput, "userId" | "id">,
) {
  const log = await prisma.insulinLog.create({
    data: { ...input, userId },
    select: INSULIN_SELECT,
  });
  await touchParticipantActivity(userId);
  return log;
}

export async function updateInsulinLog(id: string, input: Prisma.InsulinLogUpdateInput) {
  return prisma.insulinLog.update({
    where: { id },
    data: input,
    select: INSULIN_SELECT,
  });
}

export async function deleteInsulinLog(id: string): Promise<void> {
  await prisma.insulinLog.delete({ where: { id } });
}

export interface InsulinSummary {
  recordCount: number;
  /** Sum of recorded doses. Descriptive only. */
  totalUnits: number | null;
  averageUnitsPerRecord: number | null;
  averageUnitsPerDay: number | null;
  byType: Array<{ insulinType: InsulinType; count: number; totalUnits: number | null }>;
  bySite: Array<{ site: string; count: number }>;
}

export async function getInsulinSummary(params: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<InsulinSummary> {
  const where: Prisma.InsulinLogWhereInput = {
    userId: params.userId,
    administeredAt: { gte: params.from, lte: params.to },
  };

  const [totals, byType, bySite, distinctDays] = await Promise.all([
    prisma.insulinLog.aggregate({
      where,
      _count: { _all: true },
      _sum: { doseUnits: true },
      _avg: { doseUnits: true },
    }),
    prisma.insulinLog.groupBy({
      by: ["insulinType"],
      where,
      _count: { _all: true },
      _sum: { doseUnits: true },
    }),
    prisma.insulinLog.groupBy({
      by: ["injectionSite"],
      where,
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ days: bigint }>>`
      SELECT COUNT(DISTINCT DATE("administeredAt"))::bigint AS days
      FROM "InsulinLog"
      WHERE "userId" = ${params.userId}
        AND "administeredAt" >= ${params.from}
        AND "administeredAt" <= ${params.to}
    `,
  ]);

  const days = Number(distinctDays[0]?.days ?? 0);
  const totalUnits = totals._sum.doseUnits;

  return {
    recordCount: totals._count._all,
    totalUnits: round(totalUnits, 1),
    averageUnitsPerRecord: round(totals._avg.doseUnits, 1),
    averageUnitsPerDay: days > 0 && totalUnits !== null ? round(totalUnits / days, 1) : null,
    byType: byType.map((row) => ({
      insulinType: row.insulinType,
      count: row._count._all,
      totalUnits: round(row._sum.doseUnits, 1),
    })),
    bySite: bySite.map((row) => ({
      site: row.injectionSite ?? "UNSPECIFIED",
      count: row._count._all,
    })),
  };
}

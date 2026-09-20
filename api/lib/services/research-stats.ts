import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  summariseGlucose,
  summariseInsulin,
  type GlucoseSummary,
  type InsulinSummary,
} from "@/lib/services/research-formulas";

/**
 * Periodic figures for the research team, worked out from what families have
 * recorded. These are for the study's reports — nothing here reaches a phone,
 * and none of it is a dose or advice.
 */
export interface ResearchStats {
  glucose: GlucoseSummary;
  insulin: InsulinSummary;
  /** Children in scope who recorded at least one glucose reading. */
  childrenLogging: number;
  childrenInScope: number;
}

export async function getResearchStats(params: {
  userIds: string[] | null; // null = everyone
  from: Date;
  to: Date;
}): Promise<ResearchStats> {
  const userFilter = params.userIds ? { userId: { in: params.userIds } } : {};

  const [readings, doses, childrenInScope] = await Promise.all([
    prisma.glucoseReading.findMany({
      where: { ...userFilter, measuredAt: { gte: params.from, lte: params.to } },
      select: { userId: true, value: true, unit: true },
    }),
    prisma.insulinLog.findMany({
      where: { ...userFilter, administeredAt: { gte: params.from, lte: params.to } },
      select: { userId: true, doseUnits: true, administeredAt: true },
    }),
    params.userIds
      ? Promise.resolve(params.userIds.length)
      : prisma.user.count({ where: { role: "PATIENT", deletedAt: null } }),
  ]);

  const days = Math.max(1, Math.round((params.to.getTime() - params.from.getTime()) / 86_400_000));

  return {
    glucose: summariseGlucose(readings, days),
    insulin: summariseInsulin(doses),
    childrenLogging: new Set(readings.map((r) => r.userId)).size,
    childrenInScope,
  };
}

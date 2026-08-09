import "server-only";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * Helpers shared by the health-data services.
 */

export type TrendInterval = "hour" | "day" | "week" | "month";

/**
 * Maps an interval to a Postgres `date_trunc` unit.
 *
 * The value is looked up rather than interpolated so that no caller-supplied
 * string ever reaches SQL.
 */
export const TRUNC_UNIT: Record<TrendInterval, string> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
};

/**
 * Records that a participant logged something, so participant lists can sort
 * and filter by recency without scanning every health table.
 *
 * Deliberately fire-and-forget: a failure to update the rollup must not fail
 * the write that triggered it.
 */
export async function touchParticipantActivity(userId: string): Promise<void> {
  try {
    await prisma.profile.updateMany({
      where: { userId },
      data: { lastActivityAt: new Date() },
    });
  } catch (error) {
    logger.warn("activity.touch_failed", {
      userId,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

/** Rounds to a fixed number of decimals, returning null for absent input. */
export function round(value: number | null | undefined, decimals = 1): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Percentage change between two values.
 * Returns null when there is no meaningful baseline to compare against.
 */
export function percentChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return round(((current - previous) / previous) * 100, 1);
}

/**
 * Direction of travel between two periods.
 *
 * Intentionally neutral: "increasing"/"decreasing" describes the numbers, not
 * whether the change is clinically good or bad.
 */
export type TrendDirection = "increasing" | "decreasing" | "stable" | "insufficient-data";

export function trendDirection(
  current: number | null,
  previous: number | null,
  /** Relative change below this fraction counts as stable. */
  tolerance = 0.02,
): TrendDirection {
  if (current === null || previous === null) return "insufficient-data";
  if (previous === 0) return "insufficient-data";

  const delta = (current - previous) / Math.abs(previous);
  if (Math.abs(delta) < tolerance) return "stable";
  return delta > 0 ? "increasing" : "decreasing";
}

/** The equivalent-length period immediately preceding `from`. */
export function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - durationMs),
    to: new Date(from.getTime()),
  };
}

/** Whole days spanned by a range, at least 1. */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

/**
 * Conversion factor between mmol/L and mg/dL for glucose.
 * Source: molar mass of glucose, 180.16 g/mol — 1 mmol/L = 18.0182 mg/dL.
 */
export const MMOL_TO_MGDL = 18.0182;

export function glucoseToMgDl(value: number, unit: "MG_DL" | "MMOL_L"): number {
  return unit === "MG_DL" ? value : value * MMOL_TO_MGDL;
}

export function glucoseFromMgDl(value: number, unit: "MG_DL" | "MMOL_L"): number {
  return unit === "MG_DL" ? value : value / MMOL_TO_MGDL;
}

/**
 * HbA1c NGSP (%) to IFCC (mmol/mol).
 * Source: IFCC-NGSP master equation, IFCC = (NGSP − 2.15) × 10.929.
 */
export function hba1cPercentToMmolMol(percent: number): number {
  return (percent - 2.15) * 10.929;
}

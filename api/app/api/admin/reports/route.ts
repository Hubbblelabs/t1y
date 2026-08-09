import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import { getCohortBreakdown, getDashboardOverview } from "@/lib/services/analytics";
import { getAggregateGlucoseTrend } from "@/lib/services/glucose";
import { getExerciseSummary, getExerciseTrend } from "@/lib/services/exercise";
import { getAdherenceSummary, getAdherenceTrend } from "@/lib/services/medications";
import { participantScopeFilter } from "@/lib/permissions/policies";
import { prisma } from "@/lib/db/prisma";
import { dateRangeSchema, resolveDateRange } from "@/lib/validation/common";

/**
 * GET /api/admin/reports
 *
 * A consolidated operational report for the selected period: cohort
 * composition, engagement, adherence and activity, all scoped to the
 * participants the caller may see.
 *
 * Purely descriptive. It reports what was recorded — it draws no clinical
 * conclusions from the figures.
 */

const querySchema = z
  .object({ interval: z.enum(["day", "week", "month"]).default("week") })
  .and(dateRangeSchema);

export const GET = defineRoute({
  capability: Capability.REPORTS_VIEW,
  query: querySchema,
  handler: async ({ principal, query }) => {
    const range = resolveDateRange(query);

    const scope = await participantScopeFilter(principal);
    const visible = await prisma.user.findMany({
      where: { ...scope, role: "PATIENT", deletedAt: null },
      select: { id: true },
    });
    const userIds = visible.map((user) => user.id);
    const unrestricted = Object.keys(scope).length === 0;

    const [overview, breakdown, glucoseSeries, adherence, adherenceSeries, exercise, exerciseSeries] =
      await Promise.all([
        getDashboardOverview(principal, range),
        getCohortBreakdown(principal),
        getAggregateGlucoseTrend({
          ...(unrestricted ? {} : { userIds }),
          from: range.from,
          to: range.to,
          interval: query.interval,
          unit: "MG_DL",
        }),
        getAdherenceSummary({
          ...(unrestricted ? {} : { userIds }),
          from: range.from,
          to: range.to,
        }),
        getAdherenceTrend({
          ...(unrestricted ? {} : { userIds }),
          from: range.from,
          to: range.to,
          interval: query.interval,
        }),
        getExerciseSummary({
          ...(unrestricted ? {} : { userIds }),
          from: range.from,
          to: range.to,
        }),
        getExerciseTrend({
          ...(unrestricted ? {} : { userIds }),
          from: range.from,
          to: range.to,
          interval: query.interval,
        }),
      ]);

    return ok(
      {
        overview,
        breakdown,
        glucose: { series: glucoseSeries },
        medication: { summary: adherence, series: adherenceSeries },
        exercise: { summary: exercise, series: exerciseSeries },
        cohortSize: userIds.length,
      },
      {
        meta: {
          range: {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
            preset: query.range,
          },
          interval: query.interval,
          generatedAt: new Date().toISOString(),
        },
      },
    );
  },
});

import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanViewParticipantHealthData } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { getGlucoseSummary, getGlucoseTrend } from "@/lib/services/glucose";
import { getHbA1cSummary } from "@/lib/services/hba1c";
import { getMetricSeriesForParticipant } from "@/lib/services/health-metrics";
import {
  getExerciseSummary,
  getExerciseTrend,
  getWeekdayDistribution,
} from "@/lib/services/exercise";
import { getInsulinSummary } from "@/lib/services/insulin";
import {
  getAdherenceByMedication,
  getAdherenceSummary,
  getAdherenceTrend,
} from "@/lib/services/medications";
import { getNutritionSummary, getNutritionTrend } from "@/lib/services/meals";
import { resolveThresholdsForParticipant } from "@/lib/services/thresholds";
import { dateRangeSchema, idParamSchema, resolveDateRange } from "@/lib/validation/common";

/**
 * GET /api/admin/participants/:id/health
 *
 * Everything the participant detail screen's health tabs need, in one request.
 * Returning it as a single payload avoids a dozen round trips and keeps the
 * page's loading behaviour predictable.
 *
 * Configured clinical thresholds are included so the dashboard can show target
 * ranges where a clinician has defined them — and stay silent where none exist.
 */

const querySchema = z
  .object({ interval: z.enum(["hour", "day", "week", "month"]).default("day") })
  .and(dateRangeSchema);

export const GET = defineRoute({
  capability: Capability.HEALTH_DATA_VIEW,
  params: idParamSchema,
  query: querySchema,
  handler: async ({ principal, params, query, audit }) => {
    await assertCanViewParticipantHealthData(principal, params.id);

    const { from, to } = resolveDateRange(query);
    const userId = params.id;
    const window = { userId, from, to };

    const [
      glucoseSummary,
      glucoseSeries,
      adherence,
      adherenceByMedication,
      adherenceSeries,
      insulin,
      nutrition,
      nutritionSeries,
      exercise,
      exerciseSeries,
      weekdayExercise,
      hba1c,
      metrics,
      thresholds,
    ] = await Promise.all([
      getGlucoseSummary({ ...window, unit: "MG_DL" }),
      getGlucoseTrend({ ...window, interval: query.interval, unit: "MG_DL" }),
      getAdherenceSummary(window),
      getAdherenceByMedication(window),
      getAdherenceTrend({ ...window, interval: query.interval }),
      getInsulinSummary(window),
      getNutritionSummary(window),
      getNutritionTrend({ ...window, interval: query.interval }),
      getExerciseSummary(window),
      getExerciseTrend({ ...window, interval: query.interval }),
      getWeekdayDistribution(window),
      getHbA1cSummary({ userId }),
      getMetricSeriesForParticipant(window),
      resolveThresholdsForParticipant(userId),
    ]);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.HEALTH_DATA_VIEWED,
        resourceType: "health-data",
        resourceId: userId,
        participantId: userId,
        description: "Viewed participant health data",
        metadata: { range: query.range },
      },
      audit,
    );

    return ok(
      {
        glucose: { summary: glucoseSummary, series: glucoseSeries },
        medication: {
          summary: adherence,
          byMedication: adherenceByMedication,
          series: adherenceSeries,
        },
        insulin: { summary: insulin },
        nutrition: { summary: nutrition, series: nutritionSeries },
        exercise: {
          summary: exercise,
          series: exerciseSeries,
          weekday: weekdayExercise,
        },
        hba1c,
        healthMetrics: metrics,
        thresholds,
      },
      {
        meta: {
          range: { from: from.toISOString(), to: to.toISOString(), preset: query.range },
          interval: query.interval,
        },
      },
    );
  },
});

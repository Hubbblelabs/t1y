import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getGlucoseSummary, getLatestGlucose } from "@/lib/services/glucose";
import { getHbA1cSummary } from "@/lib/services/hba1c";
import { getExerciseSummary } from "@/lib/services/exercise";
import { getAdherenceSummary } from "@/lib/services/medications";
import { getNutritionSummary } from "@/lib/services/meals";
import { resolveThresholdsForParticipant } from "@/lib/services/thresholds";
import { dateRangeSchema, resolveDateRange } from "@/lib/validation/common";

/**
 * GET /api/reports/summary
 *
 * A single round trip for the mobile home screen: the caller's own headline
 * figures for the selected period, plus the clinical thresholds configured for
 * them. Thresholds are returned separately from the values so the client can
 * present a range where one exists and stay neutral where none does.
 */
export const GET = defineRoute({
  query: dateRangeSchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const userId = principal.userId;

    const [glucose, latestGlucose, hba1c, adherence, exercise, nutrition, thresholds] =
      await Promise.all([
        getGlucoseSummary({ userId, from, to, unit: "MG_DL" }),
        getLatestGlucose(userId),
        getHbA1cSummary({ userId }),
        getAdherenceSummary({ userId, from, to }),
        getExerciseSummary({ userId, from, to }),
        getNutritionSummary({ userId, from, to }),
        resolveThresholdsForParticipant(userId),
      ]);

    return ok(
      {
        glucose: { ...glucose, latest: latestGlucose },
        hba1c,
        medicationAdherence: adherence,
        exercise,
        nutrition,
        thresholds,
      },
      { meta: { range: { from: from.toISOString(), to: to.toISOString() } } },
    );
  },
});

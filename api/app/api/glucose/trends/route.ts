import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getGlucoseSummary, getGlucoseTrend } from "@/lib/services/glucose";
import { DATE_RANGE_LABELS, resolveDateRange } from "@/lib/validation/common";
import { glucoseTrendQuerySchema } from "@/lib/validation/health";

/**
 * GET /api/glucose/trends
 *
 * Descriptive statistics and a bucketed series for the caller's own readings.
 * The response reports counts, averages and direction of change; it does not
 * classify readings against any target range — that requires a configured
 * clinical threshold, which is served separately.
 */
export const GET = defineRoute({
  query: glucoseTrendQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);

    const [summary, series] = await Promise.all([
      getGlucoseSummary({
        userId: principal.userId,
        from,
        to,
        unit: query.unit,
        context: query.context,
      }),
      getGlucoseTrend({
        userId: principal.userId,
        from,
        to,
        interval: query.interval,
        unit: query.unit,
        context: query.context,
      }),
    ]);

    return ok(
      { summary, series },
      {
        meta: {
          range: {
            preset: query.range,
            label: DATE_RANGE_LABELS[query.range],
            from: from.toISOString(),
            to: to.toISOString(),
          },
          interval: query.interval,
          unit: query.unit,
        },
      },
    );
  },
});

import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { Capability } from "@/lib/permissions/roles";
import {
  getCohortBreakdown,
  getDashboardCharts,
  getDashboardOverview,
} from "@/lib/services/analytics";
import { analyticsQuerySchema } from "@/lib/validation/admin";
import { resolveDateRange } from "@/lib/validation/common";

/**
 * GET /api/admin/analytics
 *
 * Dashboard figures, scoped to the participants the caller may see.
 */
export const GET = defineRoute({
  capability: Capability.REPORTS_VIEW,
  query: analyticsQuerySchema,
  handler: async ({ principal, query }) => {
    const range = resolveDateRange(query);

    const [overview, charts, breakdown] = await Promise.all([
      getDashboardOverview(principal, range),
      getDashboardCharts(principal, range, query.interval),
      getCohortBreakdown(principal),
    ]);

    return ok(
      { overview, charts, breakdown },
      {
        meta: {
          range: {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
            preset: query.range,
          },
          interval: query.interval,
        },
      },
    );
  },
});

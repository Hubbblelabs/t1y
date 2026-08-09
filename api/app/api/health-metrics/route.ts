import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { createHealthMetric, listHealthMetrics } from "@/lib/services/health-metrics";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import {
  createHealthMetricSchema,
  healthMetricQuerySchema,
} from "@/lib/validation/health";

/**
 * Configurable health metrics (weight, blood pressure, heart rate, BMI and
 * anything added later). The set of available metrics is served by
 * /api/health-metrics/definitions.
 */

export const GET = defineRoute({
  query: healthMetricQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const { items, total } = await listHealthMetrics({
      userId: principal.userId,
      from,
      to,
      definitionId: query.definitionId,
      definitionKey: query.definitionKey,
      sortOrder: query.sortOrder,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total), {
      range: { from: from.toISOString(), to: to.toISOString() },
    });
  },
});

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: createHealthMetricSchema,
  handler: async ({ principal, body }) =>
    created(await createHealthMetric(principal.userId, body)),
});

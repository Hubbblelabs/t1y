import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { createInsulinLog, getInsulinSummary, listInsulinLogs } from "@/lib/services/insulin";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import { createInsulinLogSchema, insulinQuerySchema } from "@/lib/validation/health";

/**
 * Insulin administration records.
 *
 * The API stores what the participant reports administering. It performs no
 * dose calculation and returns no dosing recommendation.
 */

export const GET = defineRoute({
  query: insulinQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, summary] = await Promise.all([
      listInsulinLogs({
        userId: principal.userId,
        from,
        to,
        insulinType: query.insulinType,
        sortOrder: query.sortOrder,
        skip,
        take,
      }),
      getInsulinSummary({ userId: principal.userId, from, to }),
    ]);

    return paginated(items, buildPagination(query.page, query.pageSize, total), {
      summary,
      range: { from: from.toISOString(), to: to.toISOString() },
    });
  },
});

export const POST = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  body: createInsulinLogSchema,
  handler: async ({ principal, body }) =>
    created(await createInsulinLog(principal.userId, body)),
});

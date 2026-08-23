import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import {
  createHbA1cRecord,
  getHbA1cSummary,
  listHbA1cRecords,
} from "@/lib/services/hba1c";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import { createHbA1cSchema, hba1cQuerySchema } from "@/lib/validation/health";

/**
 * HbA1c results. The summary reports the latest value, the previous one and
 * the change between them — it makes no statement about whether a value is
 * acceptable.
 */

export const GET = defineRoute({
  query: hba1cQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, summary] = await Promise.all([
      listHbA1cRecords({
        userId: principal.userId,
        from,
        to,
        sortOrder: query.sortOrder,
        skip,
        take,
      }),
      getHbA1cSummary({ userId: principal.userId, from, to }),
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
  body: createHbA1cSchema,
  handler: async ({ principal, body }) =>
    created(await createHbA1cRecord(principal.userId, body)),
});

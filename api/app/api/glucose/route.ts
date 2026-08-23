import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { createGlucoseReading, listGlucoseReadings } from "@/lib/services/glucose";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import { createGlucoseSchema, glucoseQuerySchema } from "@/lib/validation/health";

/**
 * GET  /api/glucose  — the caller's own readings, paginated.
 * POST /api/glucose  — record a reading.
 *
 * Health records are always scoped to the authenticated participant. Staff
 * read participant data through /api/admin/participants/:id/glucose, which
 * applies its own authorisation and writes an audit entry.
 */

export const GET = defineRoute({
  query: glucoseQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const { items, total } = await listGlucoseReadings({
      userId: principal.userId,
      from,
      to,
      context: query.context,
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
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  body: createGlucoseSchema,
  handler: async ({ principal, body }) =>
    created(await createGlucoseReading(principal.userId, body)),
});

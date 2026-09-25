import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import {
  getAdherenceSummary,
  listMedicationLogs,
  recordMedicationLog,
} from "@/lib/services/medications";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import {
  createMedicationLogSchema,
  medicationLogQuerySchema,
} from "@/lib/validation/health";

/**
 * GET  /api/medication-logs — dose history with an adherence summary attached.
 * POST /api/medication-logs — record a dose as taken, missed or skipped.
 */

export const GET = defineRoute({
  query: medicationLogQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, adherence] = await Promise.all([
      listMedicationLogs({
        userId: principal.userId,
        from,
        to,
        medicationId: query.medicationId,
        status: query.status,
        sortOrder: query.sortOrder,
        skip,
        take,
      }),
      getAdherenceSummary({
        userId: principal.userId,
        medicationId: query.medicationId,
        from,
        to,
      }),
    ]);

    return paginated(items, buildPagination(query.page, query.pageSize, total), {
      adherence,
      range: { from: from.toISOString(), to: to.toISOString() },
    });
  },
});

export const POST = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  body: createMedicationLogSchema,
  handler: async ({ principal, body }) =>
    created(await recordMedicationLog(principal.userId, body)),
});

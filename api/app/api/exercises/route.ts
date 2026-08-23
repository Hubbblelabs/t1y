import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import {
  createExerciseLog,
  getExerciseSummary,
  listExerciseLogs,
} from "@/lib/services/exercise";
import { resolveDateRange, toSkipTake } from "@/lib/validation/common";
import { createExerciseLogSchema, exerciseQuerySchema } from "@/lib/validation/health";

/**
 * Exercise sessions logged by the participant.
 *
 * Guided programmes authored by administrators are a separate resource at
 * /api/exercise-programs.
 */

export const GET = defineRoute({
  query: exerciseQuerySchema,
  handler: async ({ principal, query }) => {
    const { from, to } = resolveDateRange(query);
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, summary] = await Promise.all([
      listExerciseLogs({
        userId: principal.userId,
        from,
        to,
        category: query.category,
        intensity: query.intensity,
        sortOrder: query.sortOrder,
        skip,
        take,
      }),
      getExerciseSummary({ userId: principal.userId, from, to }),
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
  body: createExerciseLogSchema,
  handler: async ({ principal, body }) =>
    created(await createExerciseLog(principal.userId, body)),
});

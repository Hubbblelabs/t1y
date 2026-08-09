import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listExerciseCatalogue } from "@/lib/services/exercise";

/**
 * GET /api/exercises/catalogue
 *
 * Shared activity types plus the caller's own additions, for populating the
 * activity picker in the mobile application.
 */
export const GET = defineRoute({
  handler: async ({ principal }) => ok(await listExerciseCatalogue(principal.userId)),
});

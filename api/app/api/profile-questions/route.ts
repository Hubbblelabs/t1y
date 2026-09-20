import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { listProfileQuestions } from "@/lib/services/profile-fields";

/**
 * GET /api/profile-questions — every question the profile screen asks,
 * built-in and added, in order.
 *
 * Separate from GET /api/profile-fields, which returns only added questions
 * and is what older installs read. This is for versions of the app that draw
 * the whole profile screen from one list and route each answer by `builtIn`.
 */
export const GET = defineRoute({
  handler: async () => ok(await listProfileQuestions()),
});

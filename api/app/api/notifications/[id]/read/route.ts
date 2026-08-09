import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { markNotificationRead } from "@/lib/services/notifications";
import { idParamSchema } from "@/lib/validation/common";

/**
 * POST /api/notifications/:id/read
 *
 * Ownership is enforced inside the update's `where` clause, so a notification
 * belonging to another participant is never matched in the first place.
 */
export const POST = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) =>
    ok(await markNotificationRead(params.id, principal.userId)),
});

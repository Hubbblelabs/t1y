import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { revokeShare } from "@/lib/services/guardian-shares";
import { idParamSchema } from "@/lib/validation/common";

/** DELETE /api/guardian-shares/:id — the parent cancels a link that has not been used. */
export const DELETE = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    await revokeShare(principal.userId, params.id);
    return ok({ revoked: true });
  },
});

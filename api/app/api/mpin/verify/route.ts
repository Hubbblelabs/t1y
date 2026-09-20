import { defineRoute } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { verifyMpin } from "@/lib/services/mpin";
import { verifyMpinSchema } from "@/lib/validation/household";

/**
 * POST /api/mpin/verify — unlock glucose entry for this session.
 *
 * Returns `{ ok: false }` with the remaining attempts rather than a 401 for
 * a wrong PIN: mistyping is normal, and the app needs the count to warn the
 * parent before the lock-out lands. Genuine failures (no PIN set at all)
 * still throw.
 *
 * Rate-limited on the `credential` bucket on top of the service's own
 * failed-attempt lock-out — the lock-out protects one household, the rate
 * limit protects every household from the same caller.
 */

export const POST = defineRoute({
  body: verifyMpinSchema,
  handler: async ({ principal, body }) => ok(await verifyMpin(principal.userId, body.pin)),
});

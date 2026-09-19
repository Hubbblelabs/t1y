import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { getMpinStatus, setMpin } from "@/lib/services/mpin";
import { setMpinSchema } from "@/lib/validation/household";

/**
 * GET  /api/mpin — whether a PIN is set, and whether it is currently locked.
 * POST /api/mpin — set the household's first PIN.
 *
 * Changing an existing PIN is /api/mpin/reset, which requires the account
 * password. This route refuses to overwrite one, so an unlocked phone left
 * on a table can't be used to quietly replace the gate.
 */

export const GET = defineRoute({
  handler: async ({ principal }) => ok(await getMpinStatus(principal.userId)),
});

export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: setMpinSchema,
  handler: async ({ principal, body }) => {
    await setMpin(principal.userId, body.pin);
    return noContent();
  },
});

import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { openShare } from "@/lib/services/guardian-shares";

const body = z.object({
  nonce: z.string().min(10).max(200),
  proof: z.string().length(64),
});

/**
 * POST /api/guardian/:token/open — the guardian proves they know the 6-digit
 * code (an HMAC over the nonce; the code itself is never sent) and gets back
 * which readings to ask for, encrypted under keys derived from the code.
 *
 * `csrfExempt`: nothing here rides on a cookie — the request carries its own
 * proof of the code, so there is no ambient credential to forge.
 */
export const POST = defineRoute({
  auth: "public",
  csrfExempt: true,
  rateLimit: RateLimits.anonymous,
  params: z.object({ token: z.string().min(20).max(200) }),
  body,
  handler: async ({ params, body }) => ok(await openShare(params.token, body.nonce, body.proof)),
});

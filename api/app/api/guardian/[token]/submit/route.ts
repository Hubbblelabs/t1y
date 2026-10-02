import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { submitShare } from "@/lib/services/guardian-shares";

const body = z.object({
  nonce: z.string().min(10).max(200),
  proof: z.string().length(64),
  iv: z.string().min(8).max(64),
  ct: z.string().min(16).max(8000),
});

/**
 * POST /api/guardian/:token/submit — the guardian's entries, AES-256-GCM
 * encrypted in the browser under keys derived from the code. On success the
 * readings are recorded, the link is spent and the parent is notified.
 */
export const POST = defineRoute({
  auth: "public",
  csrfExempt: true,
  rateLimit: RateLimits.anonymous,
  params: z.object({ token: z.string().min(20).max(200) }),
  body,
  handler: async ({ params, body }) => {
    await submitShare(params.token, body);
    return ok({ saved: true });
  },
});

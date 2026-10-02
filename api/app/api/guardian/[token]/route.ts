import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { getShareChallenge } from "@/lib/services/guardian-shares";

/**
 * GET /api/guardian/:token — what the guardian's page needs before it asks for
 * the code (the key-derivation salt and a nonce to prove the code against).
 * Public: the link itself is the first credential. Says nothing about the
 * child, and a wrong or spent link looks the same as one that never existed
 * apart from its own message.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: RateLimits.anonymous,
  params: z.object({ token: z.string().min(20).max(200) }),
  handler: async ({ params }) => ok(await getShareChallenge(params.token)),
});

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { checkEmailQuerySchema } from "@/lib/validation/common";

/**
 * GET /api/check-email?email=...
 *
 * Public and unauthenticated on purpose — the app's entry screen needs to
 * know whether to ask for a password (returning user) or start sign-up
 * (new user) before anyone is signed in.
 *
 * This is not a new information leak: Better Auth's own `/sign-up/email`
 * already returns a distinct "account already exists" error for a taken
 * address (needed so re-entering an existing email doesn't silently create
 * a duplicate), so existence is already observable. Rate-limited by IP like
 * every other anonymous endpoint to slow bulk enumeration either way.
 */
export const GET = defineRoute({
  auth: "public",
  rateLimit: RateLimits.anonymous,
  query: checkEmailQuerySchema,
  handler: async ({ query }) => {
    const user = await prisma.user.findUnique({
      where: { email: query.email.trim().toLowerCase() },
      select: { id: true },
    });
    return ok({ exists: user !== null });
  },
});

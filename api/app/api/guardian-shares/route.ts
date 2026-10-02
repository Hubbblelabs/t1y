import { z } from "zod";

import { GUARDIAN_COLLECT_KEYS } from "@/lib/health-data-config";
import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import {
  MAX_EXPIRY_MINUTES,
  MIN_EXPIRY_MINUTES,
  createShare,
  listShares,
} from "@/lib/services/guardian-shares";

/**
 * The parent's own links. GET lists recent ones with their status (and the
 * code while a link is still live, so the app can show it again); POST makes a
 * new one, cancelling any earlier unused link.
 */
export const GET = defineRoute({
  handler: async ({ principal }) => ok(await listShares(principal.userId)),
});

export const POST = defineRoute({
  requiresFlag: "health_logging_enabled",
  rateLimit: RateLimits.write,
  body: z.object({
    expiresInMinutes: z.number().int().min(MIN_EXPIRY_MINUTES).max(MAX_EXPIRY_MINUTES),
    /** What the guardian is asked to record — at least one thing. */
    collect: z.array(z.enum(GUARDIAN_COLLECT_KEYS)).min(1, "Choose what they should record.").max(4),
    /** A short note for the guardian, shown on their page. */
    purpose: z.string().trim().max(200, "Keep the note to 200 characters.").optional(),
  }),
  handler: async ({ principal, body }) =>
    created(
      await createShare(principal.userId, body.expiresInMinutes, {
        collect: [...new Set(body.collect)],
        purpose: body.purpose,
      }),
    ),
});

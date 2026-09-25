import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import {
  DAILY_MESSAGE_LIMIT,
  countUnreadAnswers,
  listSupportThreadsForUser,
  openSupportThread,
  remainingToday,
} from "@/lib/services/support";
import { openSupportThreadSchema } from "@/lib/validation/support";

/**
 * GET /api/support — the signed-in child's own questions and the answers to
 * them, how many answers have not been opened yet (for the badge), and how many
 * messages may still be sent today.
 */
export const GET = defineRoute({
  handler: async ({ principal }) => {
    const [threads, unreadAnswers, remaining] = await Promise.all([
      listSupportThreadsForUser(principal.userId),
      countUnreadAnswers(principal.userId),
      remainingToday(principal.userId),
    ]);
    return ok({
      threads,
      unreadAnswers,
      dailyLimit: DAILY_MESSAGE_LIMIT,
      remainingToday: remaining,
    });
  },
});

/**
 * POST /api/support — ask a new question.
 *
 * Filed against whoever is signed in, which in this app is the child's own
 * account, so a question is automatically about the right child and cannot be
 * filed against a sibling.
 */
export const POST = defineRoute({
  rateLimit: RateLimits.write,
  body: openSupportThreadSchema,
  handler: async ({ principal, body }) =>
    created(await openSupportThread({ userId: principal.userId, ...body })),
});

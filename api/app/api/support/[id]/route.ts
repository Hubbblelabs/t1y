import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import {
  getSupportThreadForUser,
  markSupportMessagesRead,
  replyToSupportThread,
} from "@/lib/services/support";
import { idParamSchema } from "@/lib/validation/common";
import { supportFollowUpSchema } from "@/lib/validation/support";

/**
 * GET /api/support/[id] — one conversation.
 *
 * Opening it marks the coordinator's answers as read, which is what the admin
 * dashboard shows beside them as "Read by the family".
 */
export const GET = defineRoute({
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    const thread = await getSupportThreadForUser(params.id, principal.userId);
    await markSupportMessagesRead({ threadId: thread.id, readerRole: "PARENT" });
    return ok(thread);
  },
});

/** POST /api/support/[id] — add to a conversation. Puts it back in the coordinator's queue. */
export const POST = defineRoute({
  rateLimit: RateLimits.write,
  params: idParamSchema,
  body: supportFollowUpSchema,
  handler: async ({ principal, params, body }) => {
    // Ownership first: replying to someone else's thread must fail exactly as
    // reading it does.
    await getSupportThreadForUser(params.id, principal.userId);
    return ok(
      await replyToSupportThread({
        threadId: params.id,
        authorId: principal.userId,
        authorRole: "PARENT",
        body: body.body,
      }),
    );
  },
});

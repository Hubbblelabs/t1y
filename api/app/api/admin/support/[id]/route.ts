import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import {
  getSupportThread,
  markSupportMessagesRead,
  replyToSupportThread,
  setSupportThreadStatus,
} from "@/lib/services/support";
import { supportReplySchema, supportStatusSchema } from "@/lib/validation/admin";
import { idParamSchema } from "@/lib/validation/common";

/**
 * GET — one conversation in full.
 *
 * Opening it marks the family's messages as read, which is what the app
 * shows them beside what they sent. Reading a thread is the act of reading
 * it, so there is nothing separate to remember to press.
 */
export const GET = defineRoute({
  capability: Capability.SUPPORT_RESPOND,
  params: idParamSchema,
  handler: async ({ params }) => {
    const thread = await getSupportThread(params.id);
    await markSupportMessagesRead({ threadId: params.id, readerRole: "ADMIN" });
    return ok(thread);
  },
});

/** POST — a coordinator answers. This is what flips the thread to Answered. */
export const POST = defineRoute({
  capability: Capability.SUPPORT_RESPOND,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: supportReplySchema,
  handler: async ({ principal, params, body, audit }) => {
    const message = await replyToSupportThread({
      threadId: params.id,
      authorId: principal.userId,
      authorRole: "ADMIN",
      body: body.body,
    });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.SUPPORT_REPLIED,
        resourceType: "support-thread",
        resourceId: params.id,
        description: "Replied to a family's question",
        // The reply itself is a family's private conversation; the audit
        // trail records that an answer was sent, never what it said.
        metadata: { messageId: message.id },
      },
      audit,
    );

    return ok(message);
  },
});

/** PATCH — close a thread, or reopen it. */
export const PATCH = defineRoute({
  capability: Capability.SUPPORT_RESPOND,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: supportStatusSchema,
  handler: async ({ principal, params, body, audit }) => {
    const thread = await setSupportThreadStatus(params.id, body.status);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.SUPPORT_STATUS_CHANGED,
        resourceType: "support-thread",
        resourceId: params.id,
        description: `Marked a question as ${body.status.toLowerCase().replace("_", " ")}`,
        metadata: { status: body.status },
      },
      audit,
    );

    return ok(thread);
  },
});

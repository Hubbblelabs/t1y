import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { reorderHelpBookTopics } from "@/lib/services/education";
import { reorderTopicsSchema } from "@/lib/validation/admin";

/**
 * PUT /api/admin/education/reorder
 *
 * Applies a drag-and-drop reordering of the Help Book. Takes the whole
 * ordered list rather than a "move topic X to position 4" instruction: the
 * list the admin is looking at is the intent, and sending all of it means a
 * concurrent edit can never interleave into a half-applied order.
 */
export const PUT = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: reorderTopicsSchema,
  handler: async ({ principal, body, audit }) => {
    await reorderHelpBookTopics(body.order);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.EDUCATION_REORDERED,
        resourceType: "education-content",
        description: `Reordered the Help Book (${body.order.length} topics)`,
        metadata: { order: body.order },
      },
      audit,
    );

    return ok({ order: body.order });
  },
});

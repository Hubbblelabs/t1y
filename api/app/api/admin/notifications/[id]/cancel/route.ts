import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { cancelCampaign } from "@/lib/services/notifications";
import { idParamSchema } from "@/lib/validation/common";

/** Cancels a scheduled notification before it is dispatched. */
export const POST = defineRoute({
  capability: Capability.NOTIFICATIONS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    const campaign = await cancelCampaign(params.id, principal.userId);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.CAMPAIGN_CANCELLED,
        resourceType: "notification-campaign",
        resourceId: params.id,
        description: `Cancelled notification "${campaign.title}"`,
      },
      audit,
    );

    return ok(campaign);
  },
});

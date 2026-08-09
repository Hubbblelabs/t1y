import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { dispatchCampaign } from "@/lib/services/notifications";
import { idParamSchema } from "@/lib/validation/common";

/**
 * Dispatches a campaign immediately.
 *
 * Creates the durable per-participant notification records; the Flutter
 * application handles push transport and fetches these on wake.
 */
export const POST = defineRoute({
  capability: Capability.NOTIFICATIONS_MANAGE,
  rateLimit: RateLimits.export,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    const result = await dispatchCampaign(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.CAMPAIGN_SENT,
        resourceType: "notification-campaign",
        resourceId: params.id,
        description: `Dispatched notification to ${result.sent} recipients`,
        metadata: { sent: result.sent },
      },
      audit,
    );

    return ok(result);
  },
});

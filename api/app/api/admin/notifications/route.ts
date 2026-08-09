import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createCampaign, listCampaigns } from "@/lib/services/notifications";
import { toSkipTake } from "@/lib/validation/common";
import { campaignListQuerySchema, createCampaignSchema } from "@/lib/validation/admin";

/**
 * Notification campaigns.
 *
 * The service rejects any message body containing a measurement — push
 * previews are visible on a locked device.
 */

export const GET = defineRoute({
  capability: Capability.NOTIFICATIONS_MANAGE,
  query: campaignListQuerySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await listCampaigns({
      status: query.status,
      type: query.type,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});

export const POST = defineRoute({
  capability: Capability.NOTIFICATIONS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createCampaignSchema,
  handler: async ({ principal, body, audit }) => {
    const campaign = await createCampaign(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: campaign.scheduledAt
          ? AuditAction.CAMPAIGN_SCHEDULED
          : AuditAction.CAMPAIGN_CREATED,
        resourceType: "notification-campaign",
        resourceId: campaign.id,
        studyId: campaign.targetStudyId,
        description: `Created notification "${campaign.title}"`,
        metadata: {
          targetType: campaign.targetType,
          recipients: campaign.totalRecipients,
        },
      },
      audit,
    );

    return created(campaign);
  },
});

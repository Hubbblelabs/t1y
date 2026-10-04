import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanEditParticipant } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { applyHealthConfig } from "@/lib/services/participants";
import { bulkHealthConfigSchema } from "@/lib/validation/admin";

/**
 * PUT /api/admin/participants/health-config
 *
 * Sets which health data several participants are asked to record — glucose
 * checks, insulin interval, exercise — in one go. Overwrites each selected
 * participant's previous configuration entirely; the dashboard shows a review
 * step before it sends this.
 */
export const PUT = defineRoute({
  capability: Capability.PARTICIPANTS_EDIT,
  rateLimit: RateLimits.adminWrite,
  body: bulkHealthConfigSchema,
  handler: async ({ principal, body, audit }) => {
    assertCanEditParticipant(principal);

    const { participantIds, ...config } = body;
    const result = await applyHealthConfig(principal, participantIds, config);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PARTICIPANT_UPDATED,
        resourceType: "participant",
        resourceId: "bulk",
        description: `Updated health data configuration for ${result.updated.length} participants`,
        metadata: { count: result.updated.length, config },
      },
      audit,
    );

    return ok(result);
  },
});

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { deleteThreshold, updateThreshold } from "@/lib/services/thresholds";
import { idParamSchema } from "@/lib/validation/common";
import { updateThresholdSchema } from "@/lib/validation/admin";

export const PATCH = defineRoute({
  capability: Capability.THRESHOLDS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateThresholdSchema,
  handler: async ({ principal, params, body, audit }) => {
    const threshold = await updateThreshold(params.id, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.THRESHOLD_UPDATED,
        resourceType: "clinical-threshold",
        resourceId: params.id,
        description: `Updated threshold "${threshold.label}"`,
        metadata: { key: threshold.key, isActive: threshold.isActive },
      },
      audit,
    );

    return ok(threshold);
  },
});

export const DELETE = defineRoute({
  capability: Capability.THRESHOLDS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    await deleteThreshold(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.THRESHOLD_DELETED,
        resourceType: "clinical-threshold",
        resourceId: params.id,
        description: "Deleted clinical threshold",
      },
      audit,
    );

    return noContent();
  },
});

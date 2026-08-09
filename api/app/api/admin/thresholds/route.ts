import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createThreshold, listThresholds } from "@/lib/services/thresholds";
import { createThresholdSchema, thresholdListQuerySchema } from "@/lib/validation/admin";

/**
 * Clinical thresholds.
 *
 * These are the only place a "target range" exists in the platform. Creating
 * one requires the `THRESHOLDS_MANAGE` capability — held by clinical reviewers
 * and super administrators — and a stated `source` recording which guideline or
 * clinician the value comes from.
 */

export const GET = defineRoute({
  // Any staff member may read thresholds; the dashboard needs them to render
  // ranges alongside recorded values.
  capability: Capability.HEALTH_DATA_VIEW,
  query: thresholdListQuerySchema,
  handler: async ({ query }) =>
    ok(
      await listThresholds({
        domain: query.domain,
        scope: query.scope,
        studyId: query.studyId,
        includeInactive: query.includeInactive,
      }),
    ),
});

export const POST = defineRoute({
  capability: Capability.THRESHOLDS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createThresholdSchema,
  handler: async ({ principal, body, audit }) => {
    const threshold = await createThreshold(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.THRESHOLD_CREATED,
        resourceType: "clinical-threshold",
        resourceId: threshold.id,
        studyId: threshold.studyId,
        participantId: threshold.userId,
        description: `Created threshold "${threshold.label}" (${threshold.key})`,
        metadata: { scope: threshold.scope, domain: threshold.domain, source: threshold.source },
      },
      audit,
    );

    return created(threshold);
  },
});

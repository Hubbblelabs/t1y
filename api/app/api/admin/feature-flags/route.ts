import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { getFeatureFlags, setFeatureFlags } from "@/lib/services/feature-flags";

const patchSchema = z.object({
  flags: z.record(z.string().trim().min(1).max(80), z.boolean()).refine((r) => Object.keys(r).length > 0, {
    message: "At least one flag is required.",
  }),
  /** Required to enable any flag with clinicalSafety: true. */
  acknowledgeClinicalSafety: z.boolean().default(false),
});

export const GET = defineRoute({
  capability: Capability.FEATURE_FLAGS_MANAGE,
  handler: async () => ok(await getFeatureFlags()),
});

export const PATCH = defineRoute({
  capability: Capability.FEATURE_FLAGS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: patchSchema,
  handler: async ({ principal, body, audit }) => {
    const { updated, rejected } = await setFeatureFlags(body.flags, principal.userId, {
      acknowledgedClinicalSafety: body.acknowledgeClinicalSafety,
    });

    for (const key of updated) {
      await recordAudit(
        actorFromPrincipal(principal),
        {
          action: AuditAction.FEATURE_FLAG_TOGGLED,
          resourceType: "feature-flag",
          resourceId: key,
          description: `Set feature flag "${key}" to ${body.flags[key]}`,
          metadata: { enabled: body.flags[key], acknowledgedClinicalSafety: body.acknowledgeClinicalSafety },
        },
        audit,
      );
    }

    const flags = await getFeatureFlags();
    return ok({ updated, rejected, flags });
  },
});

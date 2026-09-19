import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { updateProfileFieldDefinition } from "@/lib/services/profile-fields";
import { idParamSchema } from "@/lib/validation/common";
import { updateProfileFieldSchema } from "@/lib/validation/admin";

/**
 * PATCH only — there is no DELETE. Retiring a field is `active: false`,
 * which never destroys the answers already collected under its key. See
 * lib/services/profile-fields.ts for why.
 */
export const PATCH = defineRoute({
  capability: Capability.SETTINGS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateProfileFieldSchema,
  handler: async ({ principal, params, body, audit }) => {
    const field = await updateProfileFieldDefinition(params.id, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PROFILE_FIELD_UPDATED,
        resourceType: "profile-field",
        resourceId: field.id,
        description: `Updated profile field "${field.labelEn}" (${field.key})`,
        metadata: { active: field.active, required: field.required },
      },
      audit,
    );

    return ok(field);
  },
});

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import {
  createProfileFieldDefinition,
  listAllProfileFieldDefinitions,
} from "@/lib/services/profile-fields";
import { createProfileFieldSchema } from "@/lib/validation/admin";

/**
 * Admin-defined fields on the parent-facing profile form — see
 * lib/services/profile-fields.ts. GET returns every field, including
 * inactive ones, so the admin list can show what's been retired; the
 * app-facing GET /api/profile-fields returns only the active subset.
 */

export const GET = defineRoute({
  capability: Capability.SETTINGS_MANAGE,
  handler: async () => ok(await listAllProfileFieldDefinitions()),
});

export const POST = defineRoute({
  capability: Capability.SETTINGS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createProfileFieldSchema,
  handler: async ({ principal, body, audit }) => {
    const field = await createProfileFieldDefinition(body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PROFILE_FIELD_CREATED,
        resourceType: "profile-field",
        resourceId: field.id,
        description: `Added profile field "${field.labelEn}" (${field.key})`,
        metadata: { fieldType: field.fieldType, required: field.required },
      },
      audit,
    );

    return created(field);
  },
});

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { getSettings, updateSettings, type SettingKey } from "@/lib/services/settings";
import { updateSettingsSchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.SETTINGS_MANAGE,
  handler: async () => ok(await getSettings()),
});

export const PATCH = defineRoute({
  capability: Capability.SETTINGS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: updateSettingsSchema,
  handler: async ({ principal, body, audit }) => {
    const result = await updateSettings(
      body as Partial<Record<SettingKey, unknown>>,
      principal.userId,
    );

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.SETTINGS_UPDATED,
        resourceType: "system-setting",
        description: `Updated ${result.updated.length} setting(s)`,
        metadata: { keys: result.updated.join(", "), rejected: result.rejected.join(", ") },
      },
      audit,
    );

    return ok({ ...result, settings: await getSettings() });
  },
});

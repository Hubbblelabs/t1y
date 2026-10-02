import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { deleteSosContact, getSosContact, updateSosContact } from "@/lib/services/sos-contacts";
import { idParamSchema } from "@/lib/validation/common";
import { sosContactSchema } from "@/lib/validation/sos";

export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getSosContact(params.id)),
});

export const PUT = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: sosContactSchema,
  handler: async ({ principal, params, body, audit }) => {
    const contact = await updateSosContact(params.id, body);
    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.SOS_CONTACT_UPDATED,
        resourceType: "sos_contact",
        resourceId: params.id,
        description: `Updated SOS contact "${contact.name}"`,
      },
      audit,
    );
    return ok(contact);
  },
});

export const DELETE = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    const existing = await getSosContact(params.id);
    await deleteSosContact(params.id);
    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.SOS_CONTACT_DELETED,
        resourceType: "sos_contact",
        resourceId: params.id,
        description: `Deleted SOS contact "${existing.name}"`,
      },
      audit,
    );
    return ok({ deleted: true });
  },
});

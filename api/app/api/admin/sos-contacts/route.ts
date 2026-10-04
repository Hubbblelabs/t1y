import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createSosContact, listSosContacts } from "@/lib/services/sos-contacts";
import { sosContactSchema } from "@/lib/validation/sos";

// Reuses EDUCATION_MANAGE ("What families see") like the quizzes do — the same
// people decide what families are shown.
export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  handler: async () => ok(await listSosContacts()),
});

export const POST = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: sosContactSchema,
  handler: async ({ principal, body, audit }) => {
    const contact = await createSosContact(body);
    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.SOS_CONTACT_CREATED,
        resourceType: "sos_contact",
        resourceId: contact.id,
        description: `Added SOS contact "${contact.name}" (${contact.label})`,
      },
      audit,
    );
    return created(contact);
  },
});

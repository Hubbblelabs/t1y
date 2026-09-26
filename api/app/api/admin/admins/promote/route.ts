import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanAssignRole } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { findPromotablePatient, promoteToAdmin } from "@/lib/services/admins";
import { idSchema } from "@/lib/validation/common";

/**
 * Converting an existing family account to a staff account — the other half
 * of "Who can sign in" alongside creating a brand-new staff account.
 * Creating a new account with an email already in use is rejected (see
 * lib/services/admins.ts's createStaffMember); this is that same email's
 * other case, someone already in the system as a parent who also needs
 * dashboard access.
 *
 * This is a conversion, not a dual role: the account can no longer sign in
 * to the app as that child afterwards (see promoteToAdmin's own note). GET
 * looks the family account up by email so the dashboard can show who is
 * about to be converted, and warn, before POST does it.
 */
export const GET = defineRoute({
  capability: Capability.ADMINS_MANAGE,
  query: z.object({ email: z.email().max(254) }),
  handler: async ({ query }) => ok(await findPromotablePatient(query.email)),
});

export const POST = defineRoute({
  capability: Capability.ADMINS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: z.object({
    userId: idSchema,
    jobTitle: z.string().trim().max(120).optional(),
    department: z.string().trim().max(120).optional(),
    organization: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(32).optional(),
  }),
  handler: async ({ principal, body, audit }) => {
    assertCanAssignRole(principal, null);

    const staff = await promoteToAdmin(body.userId, principal.userId, {
      jobTitle: body.jobTitle,
      department: body.department,
      organization: body.organization,
      phone: body.phone,
    });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.ADMIN_PROMOTED,
        resourceType: "staff-account",
        resourceId: staff.id,
        description: `Converted ${staff.email} from a family account to a staff account`,
      },
      audit,
    );

    return created(staff);
  },
});

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanAssignRole } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { createStaffMember, listStaff } from "@/lib/services/admins";
import { toSkipTake } from "@/lib/validation/common";
import { createStaffSchema, staffListQuerySchema } from "@/lib/validation/admin";

/**
 * Staff accounts. Restricted to super administrators.
 *
 * New accounts are created with no password; the invitee sets their own via
 * the reset flow, so no administrator ever handles another person's credentials.
 */

export const GET = defineRoute({
  capability: Capability.ADMINS_MANAGE,
  query: staffListQuerySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await listStaff({
      role: query.role,
      status: query.status,
      search: query.search,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});

export const POST = defineRoute({
  capability: Capability.ADMINS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createStaffSchema,
  handler: async ({ principal, body, audit }) => {
    assertCanAssignRole(principal, null);

    const staff = await createStaffMember(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.ADMIN_CREATED,
        resourceType: "staff-account",
        resourceId: staff.id,
        description: `Created ${body.role} account for ${body.email}`,
        metadata: { role: body.role, inviteSent: staff.inviteSent },
      },
      audit,
    );

    return created(staff);
  },
});

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanAssignRole } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import {
  assertNotLastSuperAdmin,
  deactivateStaffMember,
  getStaffMember,
  updateStaffMember,
} from "@/lib/services/admins";
import { idParamSchema } from "@/lib/validation/common";
import { updateStaffSchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.ADMINS_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getStaffMember(params.id)),
});

export const PATCH = defineRoute({
  capability: Capability.ADMINS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateStaffSchema,
  handler: async ({ principal, params, body, audit }) => {
    // Nobody may change their own role or lock out the last super admin.
    if (body.role || body.status) {
      assertCanAssignRole(principal, params.id);
    }
    if (body.role && body.role !== "SUPER_ADMIN") {
      await assertNotLastSuperAdmin(params.id);
    }
    if (body.status && body.status !== "ACTIVE") {
      await assertNotLastSuperAdmin(params.id);
    }

    const staff = await updateStaffMember(params.id, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: body.role ? AuditAction.ADMIN_ROLE_CHANGED : AuditAction.ADMIN_UPDATED,
        resourceType: "staff-account",
        resourceId: params.id,
        description: body.role
          ? `Changed role of ${staff.email} to ${body.role}`
          : `Updated staff account ${staff.email}`,
        metadata: { role: staff.role, status: staff.status },
      },
      audit,
    );

    return ok(staff);
  },
});

/** Deactivates the account and revokes its sessions. Never a hard delete. */
export const DELETE = defineRoute({
  capability: Capability.ADMINS_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    assertCanAssignRole(principal, params.id);
    await assertNotLastSuperAdmin(params.id);

    const result = await deactivateStaffMember(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.ADMIN_DEACTIVATED,
        resourceType: "staff-account",
        resourceId: params.id,
        description: "Deactivated staff account and revoked sessions",
      },
      audit,
    );

    return ok(result);
  },
});

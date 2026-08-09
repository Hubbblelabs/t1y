import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { created, noContent, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import {
  grantStudyAccess,
  listStudyAccess,
  revokeStudyAccess,
} from "@/lib/services/research";
import { idParamSchema, idSchema } from "@/lib/validation/common";
import { grantAccessSchema } from "@/lib/validation/admin";

/**
 * Study access grants — the mechanism that scopes a researcher's view.
 *
 * Only roles that can manage studies may change grants; a researcher cannot
 * widen their own access.
 */

export const GET = defineRoute({
  capability: Capability.RESEARCH_MANAGE_STUDIES,
  params: idParamSchema,
  handler: async ({ params }) => ok(await listStudyAccess(params.id)),
});

export const POST = defineRoute({
  capability: Capability.RESEARCH_MANAGE_STUDIES,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: grantAccessSchema,
  handler: async ({ principal, params, body, audit }) => {
    const grant = await grantStudyAccess({
      studyId: params.id,
      userId: body.userId,
      role: body.role,
      canExport: body.canExport,
      grantedById: principal.userId,
    });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.STUDY_ACCESS_GRANTED,
        resourceType: "study-access",
        resourceId: grant.id,
        studyId: params.id,
        description: `Granted ${body.role} access to ${grant.user.email}`,
        metadata: { canExport: body.canExport },
      },
      audit,
    );

    return created(grant);
  },
});

export const DELETE = defineRoute({
  capability: Capability.RESEARCH_MANAGE_STUDIES,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: z.object({ userId: idSchema }),
  handler: async ({ principal, params, body, audit }) => {
    await revokeStudyAccess(params.id, body.userId);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.STUDY_ACCESS_REVOKED,
        resourceType: "study-access",
        studyId: params.id,
        description: "Revoked study access",
        metadata: { targetUserId: body.userId },
      },
      audit,
    );

    return noContent();
  },
});

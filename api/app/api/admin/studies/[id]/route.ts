import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanViewStudy } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { getStudy, updateStudy } from "@/lib/services/research";
import { idParamSchema } from "@/lib/validation/common";
import { updateStudySchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.RESEARCH_VIEW,
  params: idParamSchema,
  handler: async ({ principal, params }) => {
    await assertCanViewStudy(principal, params.id);
    return ok(await getStudy(params.id));
  },
});

export const PATCH = defineRoute({
  capability: Capability.RESEARCH_MANAGE_STUDIES,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateStudySchema,
  handler: async ({ principal, params, body, audit }) => {
    await assertCanViewStudy(principal, params.id);
    const study = await updateStudy(params.id, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.STUDY_UPDATED,
        resourceType: "study",
        resourceId: params.id,
        studyId: params.id,
        description: `Updated study ${study.code}`,
        metadata: { fields: Object.keys(body) },
      },
      audit,
    );

    return ok(study);
  },
});

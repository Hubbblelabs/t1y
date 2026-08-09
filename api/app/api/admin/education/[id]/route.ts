import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import {
  deleteEducation,
  getEducationById,
  updateEducation,
} from "@/lib/services/education";
import { idParamSchema } from "@/lib/validation/common";
import { updateEducationSchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getEducationById(params.id)),
});

export const PATCH = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateEducationSchema,
  handler: async ({ principal, params, body, audit }) => {
    const article = await updateEducation(params.id, body);

    // Publication state changes are recorded distinctly — they alter what
    // participants can see.
    const action =
      body.status === "PUBLISHED"
        ? AuditAction.EDUCATION_PUBLISHED
        : body.status === "DRAFT" || body.status === "ARCHIVED"
          ? AuditAction.EDUCATION_UNPUBLISHED
          : AuditAction.EDUCATION_UPDATED;

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action,
        resourceType: "education-content",
        resourceId: params.id,
        description: `Updated article "${article.title}"`,
        metadata: { status: article.status, version: article.version },
      },
      audit,
    );

    return ok(article);
  },
});

export const DELETE = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    const article = await getEducationById(params.id);
    await deleteEducation(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.EDUCATION_DELETED,
        resourceType: "education-content",
        resourceId: params.id,
        description: `Deleted article "${article.title}"`,
      },
      audit,
    );

    return noContent();
  },
});

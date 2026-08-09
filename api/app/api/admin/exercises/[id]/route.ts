import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import {
  deleteProgram,
  getProgramById,
  updateProgram,
} from "@/lib/services/exercise-content";
import { idParamSchema } from "@/lib/validation/common";
import { updateProgramSchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.EXERCISE_CONTENT_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getProgramById(params.id)),
});

export const PATCH = defineRoute({
  capability: Capability.EXERCISE_CONTENT_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateProgramSchema,
  handler: async ({ principal, params, body, audit }) => {
    const program = await updateProgram(params.id, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.EXERCISE_CONTENT_UPDATED,
        resourceType: "exercise-content",
        resourceId: params.id,
        description: `Updated programme "${program.title}"`,
        metadata: { status: program.status },
      },
      audit,
    );

    return ok(program);
  },
});

export const DELETE = defineRoute({
  capability: Capability.EXERCISE_CONTENT_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    const program = await getProgramById(params.id);
    await deleteProgram(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.EXERCISE_CONTENT_DELETED,
        resourceType: "exercise-content",
        resourceId: params.id,
        description: `Deleted programme "${program.title}"`,
      },
      audit,
    );

    return noContent();
  },
});

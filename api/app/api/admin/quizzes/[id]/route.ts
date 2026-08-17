import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { noContent, ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { deleteQuiz, getQuizById, updateQuiz } from "@/lib/services/quizzes";
import { idParamSchema } from "@/lib/validation/common";
import { updateQuizSchema } from "@/lib/validation/quizzes";

export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  params: idParamSchema,
  handler: async ({ params }) => ok(await getQuizById(params.id)),
});

export const PATCH = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateQuizSchema,
  handler: async ({ principal, params, body, audit }) => {
    const quiz = await updateQuiz(params.id, body);

    const action =
      body.status === "PUBLISHED"
        ? AuditAction.QUIZ_PUBLISHED
        : AuditAction.QUIZ_UPDATED;

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action,
        resourceType: "quiz",
        resourceId: params.id,
        description: `Updated quiz "${quiz.title}"`,
        metadata: { status: quiz.status, version: quiz.version },
      },
      audit,
    );

    return ok(quiz);
  },
});

export const DELETE = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    const quiz = await getQuizById(params.id);
    // Throws ConflictError (409) if the quiz has recorded attempts — see
    // lib/services/quizzes.ts. Not caught here: it's a normal AppError and
    // the route wrapper already knows how to turn it into a 409 envelope.
    await deleteQuiz(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.QUIZ_DELETED,
        resourceType: "quiz",
        resourceId: params.id,
        description: `Deleted quiz "${quiz.title}"`,
      },
      audit,
    );

    return noContent();
  },
});

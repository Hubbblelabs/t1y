import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createQuiz, getQuizStats, listQuizzesForAdmin } from "@/lib/services/quizzes";
import { toSkipTake } from "@/lib/validation/common";
import { createQuizSchema, quizListQuerySchema } from "@/lib/validation/quizzes";

// Reuses EDUCATION_MANAGE rather than a dedicated QUIZ_MANAGE capability —
// every person who edits an article also edits the quiz that reinforces it,
// and a separate capability for a handful of admins is over-engineering.
export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  query: quizListQuerySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);
    const [{ items, total }, stats] = await Promise.all([
      listQuizzesForAdmin({
        status: query.status,
        locale: query.locale,
        topicSlug: query.topicSlug,
        search: query.search,
        skip,
        take,
      }),
      getQuizStats(),
    ]);
    return paginated(items, buildPagination(query.page, query.pageSize, total), { stats });
  },
});

export const POST = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createQuizSchema,
  handler: async ({ principal, body, audit }) => {
    const quiz = await createQuiz(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.QUIZ_CREATED,
        resourceType: "quiz",
        resourceId: quiz.id,
        description: `Created quiz "${quiz.title}"`,
        metadata: { status: quiz.status, locale: quiz.locale, questionCount: quiz.questions.length },
      },
      audit,
    );

    return created(quiz);
  },
});

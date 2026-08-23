import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import {
  createEducation,
  getEducationStats,
  listEducationForAdmin,
} from "@/lib/services/education";
import { toSkipTake } from "@/lib/validation/common";
import { createEducationSchema, educationListQuerySchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  query: educationListQuerySchema,
  handler: async ({ query }) => {
    const { skip, take } = toSkipTake(query);

    const [{ items, total }, stats] = await Promise.all([
      listEducationForAdmin({
        status: query.status,
        category: query.category,
        locale: query.locale,
        search: query.search,
        skip,
        take,
      }),
      getEducationStats(),
    ]);

    return paginated(items, buildPagination(query.page, query.pageSize, total), { stats });
  },
});

export const POST = defineRoute({
  capability: Capability.EDUCATION_MANAGE,
  rateLimit: RateLimits.adminWrite,
  body: createEducationSchema,
  handler: async ({ principal, body, audit }) => {
    const article = await createEducation(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.EDUCATION_CREATED,
        resourceType: "education-content",
        resourceId: article.id,
        description: `Created article "${article.title}"`,
        metadata: { status: article.status, category: article.category },
      },
      audit,
    );

    return created(article);
  },
});

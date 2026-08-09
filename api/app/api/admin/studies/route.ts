import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { createStudy, listStudies } from "@/lib/services/research";
import { toSkipTake } from "@/lib/validation/common";
import { createStudySchema, studyListQuerySchema } from "@/lib/validation/admin";

export const GET = defineRoute({
  capability: Capability.RESEARCH_VIEW,
  query: studyListQuerySchema,
  handler: async ({ principal, query }) => {
    const { skip, take } = toSkipTake(query);
    const { items, total } = await listStudies(principal, {
      status: query.status,
      search: query.search,
      skip,
      take,
    });

    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});

export const POST = defineRoute({
  capability: Capability.RESEARCH_MANAGE_STUDIES,
  rateLimit: RateLimits.adminWrite,
  body: createStudySchema,
  handler: async ({ principal, body, audit }) => {
    const study = await createStudy(principal.userId, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.STUDY_CREATED,
        resourceType: "study",
        resourceId: study.id,
        studyId: study.id,
        description: `Created study ${study.code} — ${study.title}`,
      },
      audit,
    );

    return created(study);
  },
});

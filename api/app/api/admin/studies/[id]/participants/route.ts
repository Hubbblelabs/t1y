import { z } from "zod";

import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanViewStudy } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { enrollParticipant, listStudyParticipants } from "@/lib/services/research";
import { idParamSchema, paginationSchema, searchSchema, toSkipTake } from "@/lib/validation/common";
import { enrollParticipantSchema, enrollmentStatusSchema } from "@/lib/validation/admin";

const querySchema = z
  .object({
    enrollmentStatus: enrollmentStatusSchema.optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

export const GET = defineRoute({
  capability: Capability.RESEARCH_VIEW,
  params: idParamSchema,
  query: querySchema,
  handler: async ({ principal, params, query }) => {
    await assertCanViewStudy(principal, params.id);

    const { skip, take } = toSkipTake(query);
    const { items, total } = await listStudyParticipants({
      studyId: params.id,
      enrollmentStatus: query.enrollmentStatus,
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
  params: idParamSchema,
  body: enrollParticipantSchema,
  handler: async ({ principal, params, body, audit }) => {
    await assertCanViewStudy(principal, params.id);

    const enrollment = await enrollParticipant({ studyId: params.id, ...body });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.STUDY_PARTICIPANT_ENROLLED,
        resourceType: "study-participant",
        resourceId: enrollment.id,
        participantId: body.userId,
        studyId: params.id,
        description: `Enrolled participant as ${enrollment.studyParticipantCode}`,
      },
      audit,
    );

    return created(enrollment);
  },
});

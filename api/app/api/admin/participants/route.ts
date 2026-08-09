import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { buildPagination, created, paginated } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanEditParticipant } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { createParticipant, listParticipants } from "@/lib/services/participants";
import { toSkipTake } from "@/lib/validation/common";
import {
  createParticipantSchema,
  participantListQuerySchema,
} from "@/lib/validation/admin";

/**
 * The participant directory.
 *
 * `listParticipants` applies the caller's scope in SQL, so a researcher's
 * results contain only participants enrolled in studies they have access to.
 * Both operations are audited — viewing a cohort is itself a sensitive act.
 */

export const GET = defineRoute({
  capability: Capability.PARTICIPANTS_VIEW,
  query: participantListQuerySchema,
  handler: async ({ principal, query, audit }) => {
    const { skip, take } = toSkipTake(query);

    // Adherence is reported over the last 30 days unless a join filter narrows it.
    const adherenceTo = new Date();
    const adherenceFrom = new Date(adherenceTo);
    adherenceFrom.setDate(adherenceFrom.getDate() - 30);

    const { items, total } = await listParticipants(principal, {
      search: query.search,
      status: query.status,
      diabetesType: query.diabetesType,
      studyId: query.studyId,
      joinedFrom: query.joinedFrom,
      joinedTo: query.joinedTo,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      skip,
      take,
      adherenceFrom,
      adherenceTo,
    });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PARTICIPANT_LIST_VIEWED,
        resourceType: "participant",
        description: `Viewed participant list (${items.length} of ${total})`,
        metadata: { page: query.page, filtered: Boolean(query.search || query.studyId) },
      },
      audit,
    );

    return paginated(items, buildPagination(query.page, query.pageSize, total));
  },
});

export const POST = defineRoute({
  capability: Capability.PARTICIPANTS_CREATE,
  rateLimit: RateLimits.adminWrite,
  body: createParticipantSchema,
  handler: async ({ principal, body, audit }) => {
    assertCanEditParticipant(principal);

    const participant = await createParticipant(body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PARTICIPANT_CREATED,
        resourceType: "participant",
        resourceId: participant.id,
        participantId: participant.id,
        description: `Created participant ${participant.profile?.participantCode}`,
      },
      audit,
    );

    return created(participant);
  },
});

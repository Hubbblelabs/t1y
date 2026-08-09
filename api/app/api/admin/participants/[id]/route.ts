import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import {
  assertCanEditParticipant,
  assertCanViewParticipant,
} from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { getParticipantProfile, updateParticipant } from "@/lib/services/participants";
import { idParamSchema } from "@/lib/validation/common";
import { updateParticipantSchema } from "@/lib/validation/admin";

/**
 * A single participant's profile.
 *
 * Access is checked against the specific participant, not just the caller's
 * role — a researcher may hold `PARTICIPANTS_VIEW` yet still have no right to
 * this individual. Every read is recorded in the audit trail.
 */

export const GET = defineRoute({
  capability: Capability.PARTICIPANTS_VIEW,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    await assertCanViewParticipant(principal, params.id);

    const participant = await getParticipantProfile(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PARTICIPANT_VIEWED,
        resourceType: "participant",
        resourceId: params.id,
        participantId: params.id,
        description: `Viewed participant ${participant.profile?.participantCode ?? params.id}`,
      },
      audit,
    );

    return ok(participant);
  },
});

export const PATCH = defineRoute({
  capability: Capability.PARTICIPANTS_EDIT,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  body: updateParticipantSchema,
  handler: async ({ principal, params, body, audit }) => {
    assertCanEditParticipant(principal);
    await assertCanViewParticipant(principal, params.id);

    const result = await updateParticipant(params.id, body);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: body.status
          ? AuditAction.PARTICIPANT_STATUS_CHANGED
          : AuditAction.PARTICIPANT_UPDATED,
        resourceType: "participant",
        resourceId: params.id,
        participantId: params.id,
        description: body.status
          ? `Changed participant status to ${body.status}`
          : "Updated participant profile",
        // Field names only — never the values, which are personal data.
        metadata: { fields: Object.keys(body.profile ?? {}) },
      },
      audit,
    );

    return ok(result);
  },
});

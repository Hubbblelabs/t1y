import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanEditParticipant, assertCanViewParticipant } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { activateParticipant } from "@/lib/services/participants";
import { idParamSchema } from "@/lib/validation/common";

/**
 * Issues a one-time temporary password and activates a participant created
 * by `POST /api/admin/participants` — see activateParticipant's own doc for
 * why this exists (that endpoint alone leaves a permanently-stuck record).
 *
 * The temporary password appears in this response body exactly once and is
 * never written to the audit log or anywhere else in plaintext.
 */
export const POST = defineRoute({
  capability: Capability.PARTICIPANTS_EDIT,
  rateLimit: RateLimits.adminWrite,
  params: idParamSchema,
  handler: async ({ principal, params, audit }) => {
    assertCanEditParticipant(principal);
    await assertCanViewParticipant(principal, params.id);

    const result = await activateParticipant(params.id);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PARTICIPANT_ACTIVATED,
        resourceType: "participant",
        resourceId: params.id,
        participantId: params.id,
        description: "Issued a temporary password and activated the account",
      },
      audit,
    );

    return ok(result);
  },
});

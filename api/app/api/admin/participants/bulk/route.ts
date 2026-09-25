import { defineRoute } from "@/lib/api/handler";
import { ValidationError } from "@/lib/api/errors";
import { RateLimits } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { assertCanEditParticipant } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import { parseParticipantWorkbook } from "@/lib/services/participant-import";
import { bulkImportParticipants } from "@/lib/services/participants";
import { bulkImportParticipantsSchema } from "@/lib/validation/admin";

const MAX_ROWS = 1000;

/**
 * POST /api/admin/participants/bulk
 *
 * Bulk-creates participants from an uploaded .xlsx (sent as base64 — small
 * enough for hundreds of rows to stay well under the route's 1MB JSON body
 * cap). Every created account shares `dummyPassword` and is flagged
 * `mustChangePassword`, forcing each family onto their own password the
 * first time they sign in.
 *
 * Never all-or-nothing: a bad row (duplicate email, missing field) is
 * reported back per-row rather than failing the whole batch, since a
 * coordinator uploading 200 real rows shouldn't lose all of them to one typo.
 */
export const POST = defineRoute({
  capability: Capability.PARTICIPANTS_CREATE,
  rateLimit: RateLimits.adminWrite,
  body: bulkImportParticipantsSchema,
  handler: async ({ principal, body, audit }) => {
    assertCanEditParticipant(principal);

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(body.fileBase64, "base64");
    } catch {
      throw new ValidationError("The uploaded file could not be decoded.", []);
    }
    if (fileBuffer.length === 0) {
      throw new ValidationError("The uploaded file is empty.", []);
    }

    const { rows, errors: parseErrors } = await parseParticipantWorkbook(fileBuffer);

    if (rows.length === 0 && parseErrors.length === 0) {
      throw new ValidationError("No data rows were found in the uploaded file.", []);
    }
    if (rows.length > MAX_ROWS) {
      throw new ValidationError(`This file has ${rows.length} rows — import at most ${MAX_ROWS} at a time.`, []);
    }

    const { created, skipped } = await bulkImportParticipants(
      rows.map((r) => r.data),
      body.dummyPassword,
    );

    const allSkipped = [
      ...parseErrors.map((e) => ({ row: e.row, email: "", reason: e.message })),
      ...skipped,
    ].sort((a, b) => a.row - b.row);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PARTICIPANT_BULK_IMPORTED,
        resourceType: "participant",
        description: `Bulk-imported ${created.length} participant(s), ${allSkipped.length} skipped`,
        metadata: { created: created.length, skipped: allSkipped.length },
      },
      audit,
    );

    return ok({ created, skipped: allSkipped });
  },
});

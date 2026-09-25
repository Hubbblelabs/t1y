import { defineRoute } from "@/lib/api/handler";
import { Capability } from "@/lib/permissions/roles";
import { buildParticipantTemplate } from "@/lib/services/participant-import";

/**
 * GET /api/admin/participants/bulk/template
 *
 * A ready-to-fill .xlsx: header row plus one worked example, so the expected
 * date format is obvious without a separate instructions doc.
 */
export const GET = defineRoute({
  capability: Capability.PARTICIPANTS_CREATE,
  handler: async () => {
    const buffer = await buildParticipantTemplate();
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="participant-import-template.xlsx"',
      },
    });
  },
});

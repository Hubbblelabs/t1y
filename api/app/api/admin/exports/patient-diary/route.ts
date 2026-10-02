import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { Capability } from "@/lib/permissions/roles";
import { buildPatientDiaryWorkbook } from "@/lib/services/patient-diary-export";

/**
 * GET /api/admin/exports/patient-diary
 *
 * The patient-diary workbook (details, investigations, daily log) as an .xlsx
 * download. Unlike the research exports it names children — it is the clinic's
 * diary, not a research extract — so every download is audited (counts only,
 * never the values).
 */
export const GET = defineRoute({
  capability: Capability.PARTICIPANTS_VIEW,
  rateLimit: RateLimits.export,
  handler: async ({ principal, audit }) => {
    const { buffer, children, dayRows } = await buildPatientDiaryWorkbook(principal);

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.PATIENT_DIARY_EXPORTED,
        resourceType: "patient-diary",
        resourceId: "all",
        description: `Exported the patient diary for ${children} children (${dayRows} daily rows)`,
        metadata: { children, dayRows },
      },
      audit,
    );

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="patient-diary-${stamp}.xlsx"`,
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  },
});

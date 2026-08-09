import { defineRoute } from "@/lib/api/handler";
import { RateLimits } from "@/lib/api/rate-limit";
import { AuditAction, actorFromPrincipal, recordAudit } from "@/lib/audit/audit";
import { prisma } from "@/lib/db/prisma";
import { assertCanExportResearchData } from "@/lib/permissions/policies";
import { Capability } from "@/lib/permissions/roles";
import {
  buildDataset,
  exportFilename,
  toCsv,
  toPdf,
  toXlsx,
} from "@/lib/services/exports";
import { DATE_RANGE_LABELS, resolveDateRange } from "@/lib/validation/common";
import { exportRequestSchema } from "@/lib/validation/admin";

/**
 * POST /api/admin/exports
 *
 * Generates a research extract and streams it back directly.
 *
 * Datasets are pseudonymous by construction — keyed on participant codes, with
 * no names, emails or dates of birth. Every export is recorded in the audit
 * trail and in `DataExport`, so who took what, and when, is always answerable.
 *
 * Row counts are capped (see `MAX_EXPORT_ROWS`). Extracts beyond that should be
 * produced by a background job rather than inside a request.
 */
export const POST = defineRoute({
  capability: Capability.RESEARCH_EXPORT,
  rateLimit: RateLimits.export,
  body: exportRequestSchema,
  handler: async ({ principal, body, audit }) => {
    await assertCanExportResearchData(principal, body.studyId);

    const { from, to } = resolveDateRange(body);

    const dataset = await buildDataset({
      datasetType: body.datasetType,
      studyId: body.studyId,
      from,
      to,
    });

    const filename = exportFilename(body.datasetType, body.format, dataset.generatedAt);

    // Recorded before the bytes are produced, so a failed download still leaves
    // evidence that the extract was requested.
    const record = await prisma.dataExport.create({
      data: {
        studyId: body.studyId,
        datasetType: body.datasetType,
        format: body.format.toUpperCase() as "CSV" | "XLSX" | "PDF",
        filters: {
          range: body.range,
          from: from.toISOString(),
          to: to.toISOString(),
        },
        status: "COMPLETED",
        rowCount: dataset.rows.length,
        completedAt: new Date(),
        requestedById: principal.userId,
      },
      select: { id: true },
    });

    await recordAudit(
      actorFromPrincipal(principal),
      {
        action: AuditAction.RESEARCH_DATA_EXPORTED,
        resourceType: "data-export",
        resourceId: record.id,
        studyId: body.studyId,
        description: `Exported ${body.datasetType} (${dataset.rows.length} rows) as ${body.format.toUpperCase()}`,
        metadata: {
          datasetType: body.datasetType,
          format: body.format,
          rowCount: dataset.rows.length,
          truncated: dataset.truncated,
          range: body.range,
        },
      },
      audit,
    );

    const headers = new Headers({
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "X-Export-Id": record.id,
      "X-Row-Count": String(dataset.rows.length),
      ...(dataset.truncated ? { "X-Truncated": "true" } : {}),
    });

    if (body.format === "csv") {
      headers.set("Content-Type", "text/csv; charset=utf-8");
      return new Response(toCsv(dataset), { headers });
    }

    // Binary payloads are wrapped in a Blob: a bare Uint8Array is not a valid
    // `BodyInit` under the DOM lib's typings.
    if (body.format === "xlsx") {
      const contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      headers.set("Content-Type", contentType);
      return new Response(new Blob([await toXlsx(dataset)], { type: contentType }), {
        headers,
      });
    }

    headers.set("Content-Type", "application/pdf");
    const pdf = await toPdf(dataset, {
      title: "Research data extract",
      period: `${DATE_RANGE_LABELS[body.range]} (${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)})`,
      generatedBy: principal.email,
    });

    return new Response(new Blob([pdf], { type: "application/pdf" }), { headers });
  },
});

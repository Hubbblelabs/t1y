import "server-only";

import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/errors";
import { round } from "@/lib/services/shared";

/**
 * Research data export.
 *
 * Datasets are pseudonymised by construction: rows are keyed by
 * `studyParticipantCode` and never carry a name, email address, date of birth
 * or any other direct identifier. There is no option to include them — an
 * export that needs re-identification is a separate, deliberate process
 * outside this system.
 *
 * Row counts are capped so an export cannot exhaust a serverless invocation's
 * memory or time budget; larger extracts should be run as a background job.
 */

export const MAX_EXPORT_ROWS = 50_000;

export const DATASET_TYPES = [
  "participant-summary",
  "glucose",
  "medication-adherence",
  "exercise",
  "hba1c",
  "health-metrics",
] as const;

export type DatasetType = (typeof DATASET_TYPES)[number];

export interface ExportDataset {
  name: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  truncated: boolean;
  generatedAt: Date;
}

export interface ExportParams {
  datasetType: DatasetType;
  studyId?: string;
  from: Date;
  to: Date;
}

/** Enrolled participants for a study, or the whole cohort when unscoped. */
async function resolveCohort(studyId?: string) {
  if (studyId) {
    const enrollments = await prisma.studyParticipant.findMany({
      where: {
        studyId,
        enrollmentStatus: { in: ["ENROLLED", "ACTIVE", "COMPLETED"] },
      },
      select: {
        userId: true,
        studyParticipantCode: true,
        armOrGroup: true,
        enrolledAt: true,
      },
    });

    return new Map(
      enrollments.map((row) => [
        row.userId,
        {
          code: row.studyParticipantCode,
          armOrGroup: row.armOrGroup,
          enrolledAt: row.enrolledAt,
        },
      ]),
    );
  }

  const profiles = await prisma.profile.findMany({
    where: { user: { role: "PATIENT", deletedAt: null } },
    select: { userId: true, participantCode: true },
  });

  return new Map(
    profiles.map((row) => [
      row.userId,
      { code: row.participantCode, armOrGroup: null, enrolledAt: null },
    ]),
  );
}

export async function buildDataset(params: ExportParams): Promise<ExportDataset> {
  const cohort = await resolveCohort(params.studyId);
  const userIds = [...cohort.keys()];
  const generatedAt = new Date();

  if (userIds.length === 0) {
    return {
      name: params.datasetType,
      columns: [],
      rows: [],
      truncated: false,
      generatedAt,
    };
  }

  const codeFor = (userId: string) => cohort.get(userId)?.code ?? "UNKNOWN";

  switch (params.datasetType) {
    case "glucose": {
      const rows = await prisma.glucoseReading.findMany({
        where: {
          userId: { in: userIds },
          measuredAt: { gte: params.from, lte: params.to },
        },
        orderBy: [{ userId: "asc" }, { measuredAt: "asc" }],
        take: MAX_EXPORT_ROWS + 1,
        select: {
          userId: true,
          value: true,
          unit: true,
          context: true,
          measuredAt: true,
          source: true,
        },
      });

      return finalise({
        name: "Glucose readings",
        columns: ["participant_id", "measured_at", "value", "unit", "context", "source"],
        rows: rows
          .slice(0, MAX_EXPORT_ROWS)
          .map((row) => [
            codeFor(row.userId),
            row.measuredAt.toISOString(),
            row.value,
            row.unit,
            row.context,
            row.source,
          ]),
        truncated: rows.length > MAX_EXPORT_ROWS,
        generatedAt,
      });
    }

    case "hba1c": {
      const rows = await prisma.hbA1cRecord.findMany({
        where: {
          userId: { in: userIds },
          measuredAt: { gte: params.from, lte: params.to },
        },
        orderBy: [{ userId: "asc" }, { measuredAt: "asc" }],
        take: MAX_EXPORT_ROWS + 1,
        select: {
          userId: true,
          valuePercent: true,
          valueMmolMol: true,
          measuredAt: true,
          source: true,
        },
      });

      return finalise({
        name: "HbA1c results",
        columns: [
          "participant_id",
          "measured_at",
          "hba1c_percent",
          "hba1c_mmol_mol",
          "source",
        ],
        rows: rows
          .slice(0, MAX_EXPORT_ROWS)
          .map((row) => [
            codeFor(row.userId),
            row.measuredAt.toISOString(),
            row.valuePercent,
            row.valueMmolMol,
            row.source,
          ]),
        truncated: rows.length > MAX_EXPORT_ROWS,
        generatedAt,
      });
    }

    case "exercise": {
      const rows = await prisma.exerciseLog.findMany({
        where: {
          userId: { in: userIds },
          performedAt: { gte: params.from, lte: params.to },
        },
        orderBy: [{ userId: "asc" }, { performedAt: "asc" }],
        take: MAX_EXPORT_ROWS + 1,
        select: {
          userId: true,
          activityName: true,
          category: true,
          durationMinutes: true,
          intensity: true,
          distanceKm: true,
          steps: true,
          performedAt: true,
        },
      });

      return finalise({
        name: "Exercise sessions",
        columns: [
          "participant_id",
          "performed_at",
          "activity",
          "category",
          "duration_minutes",
          "intensity",
          "distance_km",
          "steps",
        ],
        rows: rows
          .slice(0, MAX_EXPORT_ROWS)
          .map((row) => [
            codeFor(row.userId),
            row.performedAt.toISOString(),
            row.activityName,
            row.category,
            row.durationMinutes,
            row.intensity,
            row.distanceKm,
            row.steps,
          ]),
        truncated: rows.length > MAX_EXPORT_ROWS,
        generatedAt,
      });
    }

    case "health-metrics": {
      const rows = await prisma.healthMetric.findMany({
        where: {
          userId: { in: userIds },
          measuredAt: { gte: params.from, lte: params.to },
        },
        orderBy: [{ userId: "asc" }, { measuredAt: "asc" }],
        take: MAX_EXPORT_ROWS + 1,
        select: {
          userId: true,
          value: true,
          secondaryValue: true,
          unit: true,
          measuredAt: true,
          definition: { select: { key: true, label: true } },
        },
      });

      return finalise({
        name: "Health metrics",
        columns: [
          "participant_id",
          "measured_at",
          "metric_key",
          "metric_label",
          "value",
          "secondary_value",
          "unit",
        ],
        rows: rows
          .slice(0, MAX_EXPORT_ROWS)
          .map((row) => [
            codeFor(row.userId),
            row.measuredAt.toISOString(),
            row.definition.key,
            row.definition.label,
            row.value,
            row.secondaryValue,
            row.unit,
          ]),
        truncated: rows.length > MAX_EXPORT_ROWS,
        generatedAt,
      });
    }

    case "medication-adherence": {
      const grouped = await prisma.medicationLog.groupBy({
        by: ["userId", "status"],
        where: {
          userId: { in: userIds },
          OR: [
            { scheduledFor: { gte: params.from, lte: params.to } },
            { scheduledFor: null, createdAt: { gte: params.from, lte: params.to } },
          ],
        },
        _count: { _all: true },
      });

      const tally = new Map<
        string,
        { taken: number; missed: number; skipped: number; pending: number }
      >();
      for (const row of grouped) {
        const entry = tally.get(row.userId) ?? {
          taken: 0,
          missed: 0,
          skipped: 0,
          pending: 0,
        };
        if (row.status === "TAKEN") entry.taken += row._count._all;
        if (row.status === "MISSED") entry.missed += row._count._all;
        if (row.status === "SKIPPED") entry.skipped += row._count._all;
        if (row.status === "PENDING") entry.pending += row._count._all;
        tally.set(row.userId, entry);
      }

      return finalise({
        name: "Medication adherence",
        columns: [
          "participant_id",
          "doses_taken",
          "doses_missed",
          "doses_skipped",
          "doses_resolved",
          "adherence_percent",
        ],
        rows: userIds.map((userId) => {
          const entry = tally.get(userId) ?? {
            taken: 0,
            missed: 0,
            skipped: 0,
            pending: 0,
          };
          const resolved = entry.taken + entry.missed + entry.skipped;
          return [
            codeFor(userId),
            entry.taken,
            entry.missed,
            entry.skipped,
            resolved,
            resolved > 0 ? round((entry.taken / resolved) * 100, 1) : null,
          ];
        }),
        truncated: false,
        generatedAt,
      });
    }

    case "participant-summary":
      return finalise(
        await buildParticipantSummary(userIds, cohort, params, generatedAt),
      );

    default:
      throw new ValidationError("Unknown dataset type.");
  }
}

/**
 * One row per participant with the headline figures — the shape the
 * requirements describe for a research extract.
 */
async function buildParticipantSummary(
  userIds: string[],
  cohort: Map<string, { code: string; armOrGroup: string | null; enrolledAt: Date | null }>,
  params: ExportParams,
  generatedAt: Date,
): Promise<ExportDataset> {
  const window = { gte: params.from, lte: params.to };

  const [profiles, glucose, adherence, exercise, hba1c, weights] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: { in: userIds } },
      // Deliberately excludes names, contact details and date of birth.
      select: {
        userId: true,
        diabetesType: true,
        diagnosisYear: true,
        treatmentModality: true,
        sex: true,
      },
    }),
    prisma.glucoseReading.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, measuredAt: window },
      _count: { _all: true },
      _avg: { value: true },
    }),
    prisma.medicationLog.groupBy({
      by: ["userId", "status"],
      where: {
        userId: { in: userIds },
        OR: [{ scheduledFor: window }, { scheduledFor: null, createdAt: window }],
      },
      _count: { _all: true },
    }),
    prisma.exerciseLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, performedAt: window },
      _sum: { durationMinutes: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ userId: string; valuePercent: number; measuredAt: Date }>>`
      SELECT DISTINCT ON ("userId") "userId", "valuePercent", "measuredAt"
      FROM "HbA1cRecord"
      WHERE "userId" = ANY(${userIds})
      ORDER BY "userId", "measuredAt" DESC
    `,
    prisma.$queryRaw<Array<{ userId: string; value: number }>>`
      SELECT DISTINCT ON (hm."userId") hm."userId", hm."value"
      FROM "HealthMetric" hm
      JOIN "HealthMetricDefinition" d ON d."id" = hm."definitionId"
      WHERE hm."userId" = ANY(${userIds}) AND d."key" = 'weight'
      ORDER BY hm."userId", hm."measuredAt" DESC
    `,
  ]);

  const profileByUser = new Map(profiles.map((row) => [row.userId, row]));
  const glucoseByUser = new Map(glucose.map((row) => [row.userId, row]));
  const exerciseByUser = new Map(exercise.map((row) => [row.userId, row]));
  const hba1cByUser = new Map(hba1c.map((row) => [row.userId, row]));
  const weightByUser = new Map(weights.map((row) => [row.userId, row.value]));

  const adherenceByUser = new Map<string, { taken: number; resolved: number }>();
  for (const row of adherence) {
    if (row.status === "PENDING") continue;
    const entry = adherenceByUser.get(row.userId) ?? { taken: 0, resolved: 0 };
    entry.resolved += row._count._all;
    if (row.status === "TAKEN") entry.taken += row._count._all;
    adherenceByUser.set(row.userId, entry);
  }

  return {
    name: "Participant summary",
    columns: [
      "study_id",
      "participant_id",
      "arm_or_group",
      "enrolled_at",
      "sex",
      "diabetes_type",
      "diagnosis_year",
      "treatment_modality",
      "glucose_readings",
      "glucose_mean",
      "medication_adherence_percent",
      "exercise_sessions",
      "exercise_minutes",
      "latest_hba1c_percent",
      "latest_hba1c_date",
      "latest_weight_kg",
    ],
    rows: userIds.map((userId) => {
      const enrolment = cohort.get(userId);
      const profile = profileByUser.get(userId);
      const glucoseRow = glucoseByUser.get(userId);
      const adherenceRow = adherenceByUser.get(userId);
      const exerciseRow = exerciseByUser.get(userId);
      const hba1cRow = hba1cByUser.get(userId);

      return [
        params.studyId ?? "",
        enrolment?.code ?? "UNKNOWN",
        enrolment?.armOrGroup ?? "",
        enrolment?.enrolledAt?.toISOString() ?? "",
        profile?.sex ?? "",
        profile?.diabetesType ?? "",
        profile?.diagnosisYear ?? null,
        profile?.treatmentModality ?? "",
        glucoseRow?._count._all ?? 0,
        round(glucoseRow?._avg.value ?? null, 1),
        adherenceRow && adherenceRow.resolved > 0
          ? round((adherenceRow.taken / adherenceRow.resolved) * 100, 1)
          : null,
        exerciseRow?._count._all ?? 0,
        exerciseRow?._sum.durationMinutes ?? 0,
        hba1cRow?.valuePercent ?? null,
        hba1cRow?.measuredAt.toISOString() ?? "",
        weightByUser.get(userId) ?? null,
      ];
    }),
    truncated: false,
    generatedAt,
  };
}

function finalise(dataset: ExportDataset): ExportDataset {
  return dataset;
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

/**
 * RFC 4180 CSV.
 *
 * Values beginning with `=`, `+`, `-` or `@` are prefixed with a single quote:
 * without it, opening the file in a spreadsheet would evaluate them as
 * formulas (CSV injection).
 */
export function toCsv(dataset: ExportDataset): string {
  const escape = (value: string | number | null): string => {
    if (value === null || value === undefined) return "";
    let text = String(value);

    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const lines = [
    dataset.columns.map(escape).join(","),
    ...dataset.rows.map((row) => row.map(escape).join(",")),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Copies into a freshly allocated `Uint8Array` so the result is pinned to
 * `ArrayBuffer` rather than `ArrayBufferLike`. Only the latter is accepted as a
 * `BlobPart`/`BodyInit`.
 */
function toResponseBytes(source: Uint8Array): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(source.byteLength);
  output.set(source);
  return output;
}

export async function toXlsx(dataset: ExportDataset): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = dataset.generatedAt;

  const sheet = workbook.addWorksheet(dataset.name.slice(0, 31) || "Data");

  sheet.addRow(dataset.columns);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of dataset.rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column, index) => {
    const header = dataset.columns[index] ?? "";
    column.width = Math.min(40, Math.max(14, header.length + 4));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return toResponseBytes(new Uint8Array(buffer));
}

/**
 * Tabular PDF report.
 *
 * Deliberately plain: a fixed-width monospace grid with a header block stating
 * the dataset, period and generation time, so a printed extract is
 * self-describing.
 */
export async function toPdf(
  dataset: ExportDataset,
  meta: { title: string; period: string; generatedBy: string },
): Promise<Uint8Array<ArrayBuffer>> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const mono = await document.embedFont(StandardFonts.Courier);

  const pageWidth = 841.89; // A4 landscape
  const pageHeight = 595.28;
  const margin = 36;
  const bodySize = 7.5;
  const lineHeight = 11;

  const columnWidth = (pageWidth - margin * 2) / Math.max(1, dataset.columns.length);
  const maxCharacters = Math.max(4, Math.floor(columnWidth / (bodySize * 0.6)));

  const truncate = (value: string | number | null) => {
    const text = value === null || value === undefined ? "" : String(value);
    return text.length > maxCharacters ? `${text.slice(0, maxCharacters - 1)}…` : text;
  };

  let page = document.addPage([pageWidth, pageHeight]);
  let cursor = pageHeight - margin;

  const drawHeader = () => {
    page.drawText(meta.title, {
      x: margin,
      y: cursor,
      size: 14,
      font: boldFont,
      color: rgb(0.1, 0.12, 0.14),
    });
    cursor -= 16;

    page.drawText(
      `${dataset.name} · ${meta.period} · generated ${dataset.generatedAt.toISOString()} by ${meta.generatedBy}`,
      { x: margin, y: cursor, size: 8, font, color: rgb(0.4, 0.44, 0.48) },
    );
    cursor -= 10;

    page.drawText(
      "Participant identifiers are pseudonymous. This extract contains no direct identifiers.",
      { x: margin, y: cursor, size: 8, font, color: rgb(0.4, 0.44, 0.48) },
    );
    cursor -= 18;

    dataset.columns.forEach((column, index) => {
      page.drawText(truncate(column), {
        x: margin + index * columnWidth,
        y: cursor,
        size: bodySize,
        font: boldFont,
        color: rgb(0.1, 0.12, 0.14),
      });
    });

    cursor -= 4;
    page.drawLine({
      start: { x: margin, y: cursor },
      end: { x: pageWidth - margin, y: cursor },
      thickness: 0.5,
      color: rgb(0.8, 0.82, 0.84),
    });
    cursor -= lineHeight;
  };

  drawHeader();

  for (const row of dataset.rows) {
    if (cursor < margin + lineHeight) {
      page = document.addPage([pageWidth, pageHeight]);
      cursor = pageHeight - margin;
      drawHeader();
    }

    row.forEach((cell, index) => {
      page.drawText(truncate(cell), {
        x: margin + index * columnWidth,
        y: cursor,
        size: bodySize,
        font: mono,
        color: rgb(0.15, 0.17, 0.19),
      });
    });

    cursor -= lineHeight;
  }

  if (dataset.rows.length === 0) {
    page.drawText("No records matched the selected period.", {
      x: margin,
      y: cursor,
      size: 9,
      font,
      color: rgb(0.4, 0.44, 0.48),
    });
  }

  return toResponseBytes(await document.save());
}

export function exportFilename(
  datasetType: string,
  format: "csv" | "xlsx" | "pdf",
  generatedAt: Date,
): string {
  const stamp = generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${datasetType}-${stamp}.${format}`;
}

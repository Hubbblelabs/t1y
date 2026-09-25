import "server-only";

import ExcelJS from "exceljs";

import { ValidationError } from "@/lib/api/errors";
import { bulkParticipantRowSchema } from "@/lib/validation/admin";
import type { BulkImportRow } from "@/lib/services/participants";

/**
 * The sample sheet handed to coordinators, and the sheet this module expects
 * back. Columns are matched by header text (case/space-insensitive), not
 * position — reordering columns in the sheet still works.
 */
export const TEMPLATE_COLUMNS = [
  { header: "Email", key: "email", required: true },
  { header: "First Name", key: "firstName", required: true },
  { header: "Last Name", key: "lastName", required: true },
  { header: "Date of Birth (YYYY-MM-DD)", key: "dateOfBirth", required: false },
  { header: "Diagnosis Year", key: "diagnosisYear", required: false },
  { header: "Phone", key: "phone", required: false },
  { header: "Participant Code (leave blank to auto-assign)", key: "participantCode", required: false },
] as const;

export async function buildParticipantTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Participants");

  sheet.columns = TEMPLATE_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: Math.max(20, column.header.length + 2),
  }));
  sheet.getRow(1).font = { bold: true };

  // One example row so the expected format (especially the date) is obvious.
  sheet.addRow({
    email: "parent.example@gmail.com",
    firstName: "Aditi",
    lastName: "Kumar",
    dateOfBirth: "2016-04-12",
    diagnosisYear: 2024,
    phone: "+91 9876543210",
    participantCode: "",
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "") // drop parenthetical hints like "(YYYY-MM-DD)"
    .replace(/\s+/g, " ");
}

const HEADER_LOOKUP = new Map(
  TEMPLATE_COLUMNS.map((column) => [normaliseHeader(column.header), column.key]),
);

export interface ParsedRow {
  row: number;
  data: BulkImportRow;
}

export interface RowError {
  row: number;
  message: string;
}

/**
 * Parses an uploaded workbook into validated rows, or per-row error
 * messages. Never throws for a bad individual row — only for a file that
 * isn't a readable workbook at all, or has no rows to import.
 */
export async function parseParticipantWorkbook(
  fileBuffer: Buffer,
): Promise<{ rows: ParsedRow[]; errors: RowError[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
  } catch {
    throw new ValidationError("Could not read this file — upload the .xlsx template.", []);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ValidationError("The workbook has no sheets.", []);

  const headerRow = sheet.getRow(1);
  const columnForIndex = new Map<number, string>();
  headerRow.eachCell((cell, colNumber) => {
    const key = HEADER_LOOKUP.get(normaliseHeader(cell.value));
    if (key) columnForIndex.set(colNumber, key);
  });

  if (columnForIndex.size === 0) {
    throw new ValidationError(
      "None of the expected columns were found — download and use the sample template.",
      [],
    );
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const excelRow = sheet.getRow(rowNumber);
    if (excelRow.actualCellCount === 0) continue;

    const raw: Record<string, unknown> = {};
    excelRow.eachCell((cell, colNumber) => {
      const key = columnForIndex.get(colNumber);
      if (!key) return;
      raw[key] = cellText(cell.value);
    });

    if (Object.values(raw).every((value) => value === undefined || value === "")) continue;

    const candidate = {
      email: raw.email,
      firstName: raw.firstName,
      lastName: raw.lastName,
      participantCode: raw.participantCode || undefined,
      diagnosisYear: raw.diagnosisYear ? Number(raw.diagnosisYear) : undefined,
      dateOfBirth: raw.dateOfBirth || undefined,
      phone: raw.phone || undefined,
    };

    const parsed = bulkParticipantRowSchema.safeParse(candidate);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join("; ");
      errors.push({ row: rowNumber, message });
      continue;
    }

    rows.push({ row: rowNumber, data: parsed.data });
  }

  return { rows, errors };
}

function cellText(value: ExcelJS.CellValue): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) return String(value.text).trim();
  return String(value).trim();
}

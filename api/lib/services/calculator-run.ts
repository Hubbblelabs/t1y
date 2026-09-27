import "server-only";

import { NotFoundError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { runCalculator, type CalculatorInput, type CalculatorOutput } from "@/lib/services/calculators";
import { resolveCatalogueValues } from "@/lib/services/health-data-catalogue";

/**
 * Running a calculator for one child, from the admin workbench.
 *
 * Calculators are not shown to a parent at all — see the change that removed
 * the phone's Calculators tab. Only staff run one, by picking a participant,
 * and this is where that happens: an input whose source is "DATA" is filled
 * in from that child's own records (as of `asOf`, so a coordinator can ask
 * "what would this have shown last Tuesday"), and any input can be
 * overridden with a typed number, exactly the way a parent's own entry used
 * to work.
 */

export interface CalculatorRunResult {
  calculator: { id: string; nameEn: string; nameTa: string | null; noteEn: string | null; noteTa: string | null };
  /** What each input actually used, and where it came from. */
  inputs: Array<{
    key: string;
    labelEn: string;
    unit: string;
    value: number | null;
    source: "OVERRIDE" | "DATA" | "MISSING";
    recordedAt: string | null;
    missingReason?: string;
  }>;
  results: Array<{ key: string; labelEn: string; labelTa: string | null; unit: string; value: number }>;
  error: string | null;
}

export async function runCalculatorForParticipant(params: {
  calculatorId: string;
  userId: string;
  asOf?: Date;
  overrides?: Record<string, number>;
}): Promise<CalculatorRunResult> {
  const calculator = await prisma.calculator.findUnique({ where: { id: params.calculatorId } });
  if (!calculator) throw new NotFoundError("Calculator");

  const user = await prisma.user.findFirst({
    where: { id: params.userId, role: "PATIENT", deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new NotFoundError("Participant");

  const asOf = params.asOf ?? new Date();
  const overrides = params.overrides ?? {};
  const inputs = calculator.inputs as unknown as CalculatorInput[];
  const outputs = calculator.outputs as unknown as CalculatorOutput[];

  // Older calculator rows stored the TDD input before DATA/sourceKey became
  // required. Treat that known input as the same participant record as the
  // current definition, rather than asking staff for a value the panel does
  // not expose.
  const participantDataKey = (input: CalculatorInput) =>
    input.source === "DATA" && input.sourceKey
      ? input.sourceKey
      : input.key === "tdd" || input.labelEn.trim().toLowerCase() === "total daily insulin dose"
        ? "insulin_total_daily_dose"
        : null;

  const dataKeys = inputs
    .filter((input) => participantDataKey(input) && overrides[input.key] === undefined)
    .map((input) => participantDataKey(input) as string);
  const resolved = dataKeys.length > 0 ? await resolveCatalogueValues(params.userId, dataKeys, asOf) : [];
  const byKey = new Map(resolved.map((value) => [value.key, value]));

  const values: Record<string, number> = {};
  const inputReport: CalculatorRunResult["inputs"] = [];

  for (const input of inputs) {
    if (overrides[input.key] !== undefined) {
      values[input.key] = overrides[input.key];
      inputReport.push({
        key: input.key,
        labelEn: input.labelEn,
        unit: input.unit,
        value: overrides[input.key],
        source: "OVERRIDE",
        recordedAt: null,
      });
      continue;
    }

    const dataKey = participantDataKey(input);
    if (dataKey) {
      const found = byKey.get(dataKey);
      if (found?.value != null) values[input.key] = found.value;
      inputReport.push({
        key: input.key,
        labelEn: input.labelEn,
        unit: input.unit,
        value: found?.value ?? null,
        source: found?.value != null ? "DATA" : "MISSING",
        recordedAt: found?.recordedAt?.toISOString() ?? null,
        ...(found?.missingReason ? { missingReason: found.missingReason } : {}),
      });
      continue;
    }

    inputReport.push({
      key: input.key,
      labelEn: input.labelEn,
      unit: input.unit,
      value: null,
      source: "MISSING",
      recordedAt: null,
      missingReason: "No value was given.",
    });
  }

  const missingManualInput = inputReport.find(
    (row) => row.value === null && row.source === "MISSING",
  );
  if (missingManualInput) {
    return {
      calculator: pickCalculator(calculator),
      inputs: inputReport,
      results: [],
      error: `Missing a value for "${missingManualInput.labelEn}". Type one in, or choose a different date.`,
    };
  }

  // A missing participant record is a valid outcome, not an invalid form.
  // There is no safe number to substitute, so leave calculation empty and let
  // the workbench explain that the participant has no data for this input.
  if (inputReport.some((row) => row.value === null)) {
    return {
      calculator: pickCalculator(calculator),
      inputs: inputReport,
      results: [],
      error: null,
    };
  }

  const { results, error } = runCalculator({ inputs, outputs }, values);

  return {
    calculator: pickCalculator(calculator),
    inputs: inputReport,
    results: results.map((result) => {
      const output = outputs.find((candidate) => candidate.key === result.key)!;
      return {
        key: result.key,
        labelEn: output.labelEn,
        labelTa: output.labelTa ?? null,
        unit: output.unit,
        value: result.value,
      };
    }),
    error,
  };
}

function pickCalculator(row: { id: string; nameEn: string; nameTa: string | null; noteEn: string | null; noteTa: string | null }) {
  return { id: row.id, nameEn: row.nameEn, nameTa: row.nameTa, noteEn: row.noteEn, noteTa: row.noteTa };
}

/** For the workbench's participant picker: a short, searchable list. */
export async function searchParticipantsForCalculator(search: string | undefined, take = 20) {
  return prisma.user.findMany({
    where: {
      role: "PATIENT",
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { profile: { participantCode: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, profile: { select: { participantCode: true } } },
    orderBy: { name: "asc" },
    take,
  });
}

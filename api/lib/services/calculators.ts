import "server-only";

import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { listCatalogueVariables } from "@/lib/services/health-data-catalogue";
import { evaluateFormula, validateFormula, FormulaError } from "@/lib/utils/formula";

/**
 * Admin-defined calculators.
 *
 * A calculator pairs a list of numbers to ask a parent for with a list of
 * results computed from them. Both live as JSON on the row; the formulas are
 * written in the closed arithmetic language in lib/utils/formula.ts and are
 * validated here, at authoring time, against the calculator's own inputs.
 *
 * ## Immutability
 *
 * There is no update function beyond {@link setCalculatorActive}. This is the
 * feature's central safety property rather than an omission — see the model
 * comment in schema.prisma. `createCalculator` is the only way a formula ever
 * enters the system, so it is the only place that has to get validation
 * right.
 */

export interface CalculatorInput {
  key: string;
  labelEn: string;
  labelTa?: string | null;
  /** Only numbers can take part in arithmetic; declared, not assumed. */
  valueType?: "NUMBER";
  /** Required — see calculatorInputSchema for why. */
  unit: string;
  min?: number | null;
  max?: number | null;
  decimals?: number | null;
  helpEn?: string | null;
  helpTa?: string | null;
  /** "ASK" (the parent types it) or "DATA" (filled from `sourceKey`). */
  source?: "ASK" | "DATA" | null;
  /** A key from lib/services/health-data-catalogue.ts, when source is DATA. */
  sourceKey?: string | null;
}

export interface CalculatorOutput {
  key: string;
  labelEn: string;
  labelTa?: string | null;
  unit: string;
  decimals?: number | null;
  expression: string;
}

export interface CreateCalculatorInput {
  nameEn: string;
  nameTa?: string | null;
  descriptionEn?: string | null;
  descriptionTa?: string | null;
  inputs: CalculatorInput[];
  outputs: CalculatorOutput[];
  noteEn?: string | null;
  noteTa?: string | null;
  sortOrder?: number;
  /** The calculator this one replaces, if any. Never modifies that row. */
  supersedesId?: string | null;
}

function generateKey(name: string): string {
  const stem = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return stem ? `${stem}-${suffix}` : `calculator-${suffix}`;
}

/**
 * Checks every formula before anything is stored.
 *
 * Each output may use the calculator's inputs and any output defined *before*
 * it, which is what lets a meal-dose result be written in terms of a ratio
 * computed a line above. Ordering matters, so the available names grow as the
 * list is walked — a formula referring to a later output is rejected rather
 * than silently reading a value that does not exist yet.
 */
function assertFormulasAreSound(inputs: CalculatorInput[], outputs: CalculatorOutput[]): void {
  const issues: Array<{ field: string; message: string }> = [];

  const seen = new Set<string>();
  for (const [index, input] of inputs.entries()) {
    if (seen.has(input.key)) {
      issues.push({ field: `inputs.${index}.key`, message: `"${input.key}" is used twice.` });
    }
    seen.add(input.key);
  }

  const available = new Set(seen);
  for (const [index, output] of outputs.entries()) {
    if (available.has(output.key)) {
      issues.push({ field: `outputs.${index}.key`, message: `"${output.key}" is used twice.` });
    }

    const problem = validateFormula(output.expression, [...available]);
    if (problem) {
      issues.push({ field: `outputs.${index}.expression`, message: problem });
    }

    available.add(output.key);
  }

  if (issues.length > 0) {
    throw new ValidationError("This calculator's formulas need fixing.", issues);
  }
}

/**
 * Runs a calculator against a set of values.
 *
 * Shared by the admin's "try it" preview and by any server-side use, so what
 * an author sees while writing a formula is produced by the same code that
 * will run it later. Outputs are computed in order and fed into the ones
 * after them.
 */
export function runCalculator(
  calculator: { inputs: CalculatorInput[]; outputs: CalculatorOutput[] },
  values: Record<string, number>,
): { results: Array<{ key: string; value: number }>; error: string | null } {
  const scope: Record<string, number> = {};

  for (const input of calculator.inputs) {
    const value = values[input.key];
    if (value === undefined || !Number.isFinite(value)) {
      return {
        results: [],
        error: `Enter a number for "${input.labelEn}".`,
      };
    }

    /*
     * Zero and negative numbers are refused unless the calculator explicitly
     * allows them.
     *
     * Every quantity these calculators work on — a daily insulin dose, the
     * carbohydrates in a meal, a glucose reading, a weight — is positive in
     * reality. A zero or a minus sign is a slip of the finger, an empty
     * meter, or a field that was never really filled in. Left through, a
     * zero denominator stops the whole calculation dead and a negative one
     * produces a confidently wrong dose with no outward sign anything is
     * amiss.
     *
     * An admin opts a field into accepting them by deliberately setting its
     * minimum to zero or below, which is the only way this rule is relaxed.
     */
    const allowsZeroOrLess = input.min != null && input.min <= 0;
    if (!allowsZeroOrLess && value <= 0) {
      return {
        results: [],
        error:
          `"${input.labelEn}" must be more than zero. Please check the number ` +
          `and enter it again.`,
      };
    }

    if (input.min != null && value < input.min) {
      return { results: [], error: `"${input.labelEn}" cannot be less than ${input.min}.` };
    }
    if (input.max != null && value > input.max) {
      return { results: [], error: `"${input.labelEn}" cannot be more than ${input.max}.` };
    }
    scope[input.key] = value;
  }

  const results: Array<{ key: string; value: number }> = [];
  for (const output of calculator.outputs) {
    try {
      const value = evaluateFormula(output.expression, scope);
      scope[output.key] = value;
      results.push({ key: output.key, value });
    } catch (error) {
      if (error instanceof FormulaError) return { results: [], error: error.message };
      throw error;
    }
  }

  return { results, error: null };
}

/**
 * Confirms every "use data we already have" input names something real.
 *
 * The catalogue is read live rather than trusted from the request: a medical
 * profile field can be retired between the admin loading the page and saving,
 * and a calculator pointing at a value that no longer exists would silently
 * have nothing to fill in.
 */
async function assertDataSourcesExist(inputs: CalculatorInput[]): Promise<void> {
  const dataInputs = inputs.filter((input) => input.source === "DATA");
  if (dataInputs.length === 0) return;

  const available = new Set((await listCatalogueVariables()).map((variable) => variable.key));
  const issues = dataInputs.flatMap((input, index) => {
    if (!input.sourceKey) {
      return [{ field: `inputs.${index}.sourceKey`, message: "Choose which data to use." }];
    }
    if (!available.has(input.sourceKey)) {
      return [
        {
          field: `inputs.${index}.sourceKey`,
          message: `"${input.sourceKey}" is not something we hold about a child.`,
        },
      ];
    }
    return [];
  });

  if (issues.length > 0) {
    throw new ValidationError("This calculator refers to data that is not available.", issues);
  }
}

export async function createCalculator(createdById: string, input: CreateCalculatorInput) {
  if (input.inputs.length === 0) {
    throw new ValidationError("A calculator needs at least one number to ask for.", [
      { field: "inputs", message: "Add at least one." },
    ]);
  }
  if (input.outputs.length === 0) {
    throw new ValidationError("A calculator needs at least one result.", [
      { field: "outputs", message: "Add at least one." },
    ]);
  }

  assertFormulasAreSound(input.inputs, input.outputs);
  await assertDataSourcesExist(input.inputs);

  const created = await prisma.calculator.create({
    data: {
      key: generateKey(input.nameEn),
      nameEn: input.nameEn,
      nameTa: input.nameTa ?? null,
      descriptionEn: input.descriptionEn ?? null,
      descriptionTa: input.descriptionTa ?? null,
      inputs: input.inputs as unknown as object,
      outputs: input.outputs as unknown as object,
      noteEn: input.noteEn ?? null,
      noteTa: input.noteTa ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdById,
    },
  });

  // Superseding is recorded on the *old* row as a pointer forward, and is the
  // one write ever made to an existing calculator besides `active`. It
  // changes no formula.
  if (input.supersedesId) {
    await prisma.calculator.update({
      where: { id: input.supersedesId },
      data: { supersededById: created.id, active: false },
    });
  }

  return created;
}

export async function setCalculatorActive(id: string, active: boolean) {
  const existing = await prisma.calculator.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Calculator");

  return prisma.calculator.update({ where: { id }, data: { active } });
}

export async function listCalculatorsForAdmin() {
  return prisma.calculator.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function getCalculatorById(id: string) {
  const calculator = await prisma.calculator.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  if (!calculator) throw new NotFoundError("Calculator");
  return calculator;
}


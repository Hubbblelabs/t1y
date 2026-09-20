import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  createCalculator,
  getCalculatorById,
  listCalculatorsForAdmin,
  runCalculator,
  setCalculatorActive,
  type CalculatorInput,
  type CalculatorOutput,
} from "@/lib/services/calculators";
import { listHelpBookTopics, reorderHelpBookTopics } from "@/lib/services/education";
import {
  listCatalogueVariables,
  resolveCatalogueValues,
} from "@/lib/services/health-data-catalogue";
import {
  createProfileFieldDefinition,
  updateProfileFieldDefinition,
} from "@/lib/services/profile-fields";
import { listQuizGroups } from "@/lib/services/quizzes";
import { ValidationError } from "@/lib/api/errors";

/**
 * The rebuilt admin dashboard, against the development database.
 *
 * Unit tests prove the formula grammar in the abstract (tests/unit/formula.test.ts).
 * This proves the things a coordinator actually does in the dashboard behave
 * correctly against real rows: that the bilingual lists group, that a
 * calculator cannot be created with a broken or dishonest formula, that
 * hiding one works, and — most importantly — that a missing health reading
 * never silently becomes a zero in a dose calculation.
 *
 * Everything written here is cleaned up afterwards. Calculators are removed
 * with a direct delete because the service deliberately offers no delete: a
 * calculator families may have used is never destroyed in normal operation.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test
 */

const createdCalculatorIds: string[] = [];
const createdProfileFieldIds: string[] = [];

afterAll(async () => {
  if (createdCalculatorIds.length > 0) {
    await prisma.calculator.deleteMany({ where: { id: { in: createdCalculatorIds } } });
  }
  if (createdProfileFieldIds.length > 0) {
    await prisma.profileFieldDefinition.deleteMany({
      where: { id: { in: createdProfileFieldIds } },
    });
  }
});

async function anAdminId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No admin in the development database. Run `npm run db:seed`.");
  return admin.id;
}

function input(over: Partial<CalculatorInput> = {}): CalculatorInput {
  return { key: "tdd", labelEn: "Total daily dose", unit: "units", ...over };
}

function output(over: Partial<CalculatorOutput> = {}): CalculatorOutput {
  return {
    key: "icRatio",
    labelEn: "Carb ratio",
    unit: "g per unit",
    expression: "500 / tdd",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Help Book
// ---------------------------------------------------------------------------

describe("Help Book library", () => {
  it("shows one entry per topic, not one per language", async () => {
    const topics = await listHelpBookTopics();
    const rows = await prisma.educationContent.count();

    expect(topics.length).toBeGreaterThan(0);
    // The bug this replaced: 16 stored rows listed as 16 topics.
    expect(topics.length).toBeLessThan(rows);

    const distinctSlugs = await prisma.educationContent.groupBy({ by: ["slug"] });
    expect(topics.length).toBe(distinctSlugs.length);
  });

  it("pairs the two languages of a topic into one entry", async () => {
    const topics = await listHelpBookTopics();
    const paired = topics.find((topic) => topic.versions.EN && topic.versions.TA);

    expect(paired, "expected at least one topic with both languages").toBeDefined();
    expect(paired!.versions.EN!.id).not.toBe(paired!.versions.TA!.id);
    // The listed title comes from English when it exists.
    expect(paired!.displayTitle).toBe(paired!.versions.EN!.title);
  });

  it("reorders both languages of a topic together", async () => {
    const before = await listHelpBookTopics();
    if (before.length < 2) return;

    const original = before.map((topic) => topic.slug);
    const moved = [original[1], original[0], ...original.slice(2)];

    try {
      await reorderHelpBookTopics(moved);

      const after = await listHelpBookTopics();
      expect(after.map((topic) => topic.slug)).toEqual(moved);

      // Both stored rows for the moved topic must agree on its position —
      // a half-applied reorder would split a topic across two places.
      const rows = await prisma.educationContent.findMany({
        where: { slug: moved[0] },
        select: { sortOrder: true },
      });
      expect(new Set(rows.map((row) => row.sortOrder)).size).toBe(1);
    } finally {
      await reorderHelpBookTopics(original);
    }
  });
});

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

describe("Quiz library", () => {
  it("shows one entry per quiz, with a slot for each language", async () => {
    const groups = await listQuizGroups();
    const distinctSlugs = await prisma.quiz.groupBy({ by: ["slug"] });

    expect(groups.length).toBe(distinctSlugs.length);
    for (const group of groups) {
      expect(group.versions.EN ?? group.versions.TA).toBeTruthy();
    }
  });

  it("reports a missing translation rather than hiding it", async () => {
    const groups = await listQuizGroups();
    for (const group of groups) {
      // Whichever language is absent must be explicitly null, which is what
      // the list renders an "Add Tamil"/"Add English" button for.
      expect(group.versions).toHaveProperty("EN");
      expect(group.versions).toHaveProperty("TA");
    }
  });
});

// ---------------------------------------------------------------------------
// Calculators
// ---------------------------------------------------------------------------

describe("Calculators", () => {
  it("reproduces the curriculum's own formulas from the seeded rows", async () => {
    const calculators = await listCalculatorsForAdmin();
    const rapid = calculators.find((row) => row.nameEn.includes("rapid-acting"));
    expect(rapid, "run `npm run calculators:seed-standard`").toBeDefined();

    const { results, error } = runCalculator(
      {
        inputs: rapid!.inputs as unknown as CalculatorInput[],
        outputs: rapid!.outputs as unknown as CalculatorOutput[],
      },
      { tdd: 20 },
    );

    expect(error).toBeNull();
    // 500/20 = 25 g per unit, 1800/20 = 90 mg/dL per unit — the same numbers
    // the app's hardcoded calculator has always produced.
    expect(results.find((r) => r.key === "ic")?.value).toBe(25);
    expect(results.find((r) => r.key === "isf")?.value).toBe(90);
  });

  it("reproduces every worked example in the study documents", async () => {
    const all = await listCalculatorsForAdmin();
    const run = (name: string, values: Record<string, number>) => {
      const row = all.find((c) => c.nameEn.includes(name));
      expect(row, name).toBeDefined();
      const out = runCalculator(
        {
          inputs: row!.inputs as unknown as CalculatorInput[],
          outputs: row!.outputs as unknown as CalculatorOutput[],
        },
        values,
      );
      expect(out.error, name).toBeNull();
      return Object.fromEntries(out.results.map((r) => [r.key, r.value]));
    };

    // Nutrition: 3 + 5 + 5 + 12 = 25 units a day.
    expect(run("Total daily dose", { basal: 12, breakfast: 3, lunch: 5, dinner: 5, other: 0 }).tdd).toBe(25);
    // 500 / 25 = 20 and 1500 / 25 = 60.
    const short = run("short-acting", { tdd: 25 });
    expect(short.ic).toBe(20);
    expect(short.isf).toBe(60);
    // 100 g / 20 = 5 units.
    expect(run("Mealtime dose from", { carbs: 100, ic: 20 }).meal).toBe(5);
    // (330 - 150) / 60 = +3, and (60 - 150) / 60 = -1.5.
    expect(run("Correction dose", { glucose: 330, target: 150, isf: 60 }).correction).toBe(3);
    expect(run("Correction dose", { glucose: 60, target: 150, isf: 60 }).correction).toBe(-1.5);
    // 5 + 3 = 8 units.
    expect(
      run("Total mealtime", { carbs: 100, ic: 20, glucose: 330, target: 150, isf: 60 }).total,
    ).toBe(8);
    // (100 - 40) / 5 = 12 g of sugar.
    expect(run("Sugar needed", { glucose: 40, target: 100 }).sugar).toBe(12);
    // 20 units on a 40-unit syringe = 8.
    expect(run("40-unit syringe", { dose: 20 }).draw).toBe(8);
    // Pump: 80% of 25 = 20 a day, 20/24 an hour, x0.5, x1.5.
    const pump = run("pump basal", { tdd: 25 });
    expect(pump.daily).toBe(20);
    expect(pump.night).toBeCloseTo((20 / 24) * 0.5, 10);
    expect(pump.dawn).toBeCloseTo((20 / 24) * 1.5, 10);
  });

  it("has exactly the nine documented calculators", async () => {
    expect((await listCalculatorsForAdmin()).length).toBe(9);
  });

  it("every seeded input and output declares a unit", async () => {
    for (const calculator of await listCalculatorsForAdmin()) {
      for (const row of calculator.inputs as unknown as CalculatorInput[]) {
        expect(row.unit, `${calculator.nameEn} → ${row.key}`).toBeTruthy();
      }
      for (const row of calculator.outputs as unknown as CalculatorOutput[]) {
        expect(row.unit, `${calculator.nameEn} → ${row.key}`).toBeTruthy();
      }
    }
  });

  it("refuses a formula naming something that is not an input", async () => {
    await expect(
      createCalculator(await anAdminId(), {
        nameEn: "Test — bad name",
        inputs: [input()],
        outputs: [output({ expression: "500 / ttd" })],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses a formula that refers to a later result", async () => {
    await expect(
      createCalculator(await anAdminId(), {
        nameEn: "Test — forward reference",
        inputs: [input()],
        outputs: [
          output({ key: "first", expression: "second * 2" }),
          output({ key: "second", expression: "tdd" }),
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses a 'use data we hold' input naming something we do not hold", async () => {
    await expect(
      createCalculator(await anAdminId(), {
        nameEn: "Test — bogus source",
        inputs: [input({ source: "DATA", sourceKey: "not_a_real_measurement" })],
        outputs: [output()],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("accepts a data-sourced input that names a real catalogue entry", async () => {
    const created = await createCalculator(await anAdminId(), {
      nameEn: "Test — real source",
      inputs: [
        input({ key: "glucose", labelEn: "Glucose", unit: "mg/dL", source: "DATA", sourceKey: "glucose_latest" }),
      ],
      outputs: [output({ key: "half", expression: "glucose / 2", unit: "mg/dL" })],
    });
    createdCalculatorIds.push(created.id);

    expect(created.active).toBe(true);
  });

  it("can be hidden and shown again, and nothing else about it changes", async () => {
    const adminId = await anAdminId();
    const created = await createCalculator(adminId, {
      nameEn: "Test — visibility",
      inputs: [input()],
      outputs: [output()],
    });
    createdCalculatorIds.push(created.id);

    await setCalculatorActive(created.id, false);
    const hidden = await getCalculatorById(created.id);
    expect(hidden.active).toBe(false);
    // The formulas are the thing that must never drift.
    expect(hidden.outputs).toEqual(created.outputs);

    await setCalculatorActive(created.id, true);
    expect((await getCalculatorById(created.id)).active).toBe(true);
  });

  it("hides the calculator it replaces, leaving that one's formulas intact", async () => {
    const adminId = await anAdminId();
    const original = await createCalculator(adminId, {
      nameEn: "Test — original",
      inputs: [input()],
      outputs: [output({ expression: "500 / tdd" })],
    });
    createdCalculatorIds.push(original.id);

    const replacement = await createCalculator(adminId, {
      nameEn: "Test — replacement",
      inputs: [input()],
      outputs: [output({ expression: "450 / tdd" })],
      supersedesId: original.id,
    });
    createdCalculatorIds.push(replacement.id);

    const superseded = await getCalculatorById(original.id);
    expect(superseded.active).toBe(false);
    expect(superseded.supersededById).toBe(replacement.id);
    // Superseding must never rewrite the old arithmetic.
    expect(superseded.outputs).toEqual(original.outputs);
  });

  it("refuses zero, and says what to do about it", () => {
    const { results, error } = runCalculator(
      { inputs: [input()], outputs: [output()] },
      { tdd: 0 },
    );
    expect(results).toEqual([]);
    expect(error).toBe(
      '"Total daily dose" must be more than zero. Please check the number and enter it again.',
    );
  });

  it("refuses a negative number", () => {
    const { results, error } = runCalculator(
      { inputs: [input()], outputs: [output()] },
      { tdd: -12 },
    );
    expect(results).toEqual([]);
    expect(error).toMatch(/must be more than zero/);
  });

  it("refuses zero even when the formula would not have divided by it", () => {
    // The guard is about the number being wrong, not about protecting the
    // arithmetic — a meal of "0 g" is a field nobody actually filled in.
    const { error } = runCalculator(
      {
        inputs: [input({ key: "carbs", labelEn: "Carbohydrates", unit: "g" })],
        outputs: [output({ key: "doubled", expression: "carbs * 2", unit: "g" })],
      },
      { carbs: 0 },
    );
    expect(error).toMatch(/must be more than zero/);
  });

  it("allows zero only when the calculator deliberately permits it", () => {
    const { results, error } = runCalculator(
      {
        inputs: [input({ key: "correction", labelEn: "Correction", unit: "units", min: -10 })],
        outputs: [output({ key: "doubled", expression: "correction * 2", unit: "units" })],
      },
      { correction: 0 },
    );
    expect(error).toBeNull();
    expect(results[0].value).toBe(0);
  });

  it("refuses a value outside the range the calculator allows", () => {
    const { error } = runCalculator(
      { inputs: [input({ min: 1, max: 200 })], outputs: [output()] },
      { tdd: 900 },
    );
    expect(error).toMatch(/cannot be more than 200/);
  });
});

// ---------------------------------------------------------------------------
// The data a calculator may draw on
// ---------------------------------------------------------------------------

describe("Health data catalogue", () => {
  it("offers glucose and insulin, and says which have nothing recorded", async () => {
    const variables = await listCatalogueVariables();
    const keys = variables.map((variable) => variable.key);

    expect(keys).toContain("glucose_latest");
    expect(keys).toContain("insulin_total_daily_dose");

    for (const variable of variables) {
      expect(variable.unit, `${variable.key} needs a unit`).toBeTruthy();
      expect(typeof variable.hasData).toBe("boolean");
    }
  });

  it("never offers engagement data to a formula", async () => {
    const keys = (await listCatalogueVariables()).map((variable) => variable.key);
    // Progress, quizzes, badges and streaks exist to encourage the child.
    // They say nothing about their body, so they must stay unreachable from
    // anything that works out a dose.
    for (const forbidden of ["topics_read", "quizzes_taken", "streak", "badges", "progress"]) {
      expect(keys.some((key) => key.includes(forbidden))).toBe(false);
    }
  });

  it("reports a missing reading as nothing, never as zero", async () => {
    // A user guaranteed to have no readings of their own.
    const orphan = await prisma.user.create({
      data: { id: `test-orphan-${Date.now()}`, email: `orphan-${Date.now()}@example.test`, name: "Orphan", emailVerified: false },
      select: { id: true },
    });

    try {
      const resolved = await resolveCatalogueValues(orphan.id, [
        "glucose_latest",
        "insulin_total_daily_dose",
      ]);

      for (const entry of resolved) {
        // The whole point: 0 mg/dL is a dangerous lie, null is the truth.
        expect(entry.value).toBeNull();
        expect(entry.value).not.toBe(0);
        expect(entry.missingReason).toBeTruthy();
      }
    } finally {
      await prisma.user.delete({ where: { id: orphan.id } });
    }
  });

  it("returns a stored glucose reading in mg/dL with the time it was taken", async () => {
    const reading = await prisma.glucoseReading.findFirst({
      orderBy: { measuredAt: "desc" },
      select: { userId: true, value: true, unit: true },
    });
    if (!reading) return;

    const [resolved] = await resolveCatalogueValues(reading.userId, ["glucose_latest"]);

    expect(resolved.value).not.toBeNull();
    expect(resolved.recordedAt).toBeInstanceOf(Date);

    // An mmol/L reading must arrive converted — handing 8.6 to a formula
    // expecting mg/dL would understate a correction dose eighteenfold.
    const expected = reading.unit === "MMOL_L" ? reading.value * 18.0182 : reading.value;
    expect(resolved.value).toBeCloseTo(expected, 3);
  });
});

// ---------------------------------------------------------------------------
// Profile questions
// ---------------------------------------------------------------------------

describe("Profile questions marked as medical", () => {
  it("appears in the calculator catalogue only once marked medical", async () => {
    const key = `testHeight${Date.now()}`;

    const field = await createProfileFieldDefinition({
      key,
      fieldType: "NUMBER",
      labelEn: "Test height",
      unit: "cm",
      isMedical: false,
    });
    createdProfileFieldIds.push(field.id);

    const before = await listCatalogueVariables();
    expect(before.some((variable) => variable.key === `profile_${key}`)).toBe(false);

    await updateProfileFieldDefinition(field.id, { isMedical: true });

    const after = await listCatalogueVariables();
    const added = after.find((variable) => variable.key === `profile_${key}`);
    expect(added, "a medical number field should be usable in a calculator").toBeDefined();
    expect(added!.unit).toBe("cm");
  });

  it("keeps a medical choice out of the catalogue until every option has a number", async () => {
    const key = `testChoice${Date.now()}`;

    const field = await createProfileFieldDefinition({
      key,
      fieldType: "CHOICE",
      labelEn: "Test choice",
      isMedical: true,
      options: [
        { value: "a", labelEn: "A" },
        { value: "b", labelEn: "B" },
      ],
    });
    createdProfileFieldIds.push(field.id);

    // No numbers yet: arithmetic on "A" is meaningless, so it must not appear.
    const before = await listCatalogueVariables();
    expect(before.some((variable) => variable.key === `profile_${key}`)).toBe(false);

    await updateProfileFieldDefinition(field.id, {
      options: [
        { value: "a", labelEn: "A", numericValue: 1 },
        { value: "b", labelEn: "B", numericValue: 0 },
      ],
    });

    const after = await listCatalogueVariables();
    expect(after.some((variable) => variable.key === `profile_${key}`)).toBe(true);
  });
});

/**
 * Supersedes every live calculator still asking a parent to manually type an
 * insulin-to-carb ratio or correction factor — numbers the app has nowhere
 * on record, since a family only ever logs a glucose reading, an insulin
 * dose, or a meal's carbohydrates (see record_screen.dart). Those ratios are
 * computable from the same 7-day logged-insulin average (TDD) already
 * powering the ratio and pump-basal calculators, via the same 500/1800/1500
 * rules — see scripts/seed-standard-calculators.ts for the corrected
 * definitions and the reasoning in full.
 *
 * A calculator's formula is immutable once created (see the Calculator
 * model comment in prisma/schema.prisma) — this script does the same
 * create-and-supersede that scripts/fix-tdd-calculator.ts did for the total
 * daily dose calculator, for the three that were still wrong:
 *
 *   - "Mealtime dose from carbohydrates" — same name as its replacement, so
 *     the ordinary seed script (which only adds calculators whose name is
 *     new) would never have touched it. Superseded by a corrected
 *     calculator of the same name.
 *   - "Correction dose for glucose before a meal" — replaced by two rules
 *     (scripts/seed-standard-calculators.ts creates these as new rows, since
 *     their names changed to say which insulin type each is for), and
 *     deactivated here, superseded by the rapid-acting variant.
 *   - "Total mealtime insulin" — same treatment, superseded by the
 *     rapid-acting variant of the two new "Total mealtime insulin — …" rows.
 *
 * Run scripts/seed-standard-calculators.ts FIRST (no flags) so the four new
 * rapid/regular calculators exist, then run this with: npx tsx
 * scripts/fix-manual-ratio-calculators.ts [--dry-run]
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { validateFormula } from "../lib/utils/formula";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const dryRun = process.argv.includes("--dry-run");

type Row = {
  id: string;
  createdById: string;
  sortOrder: number;
  noteEn: string | null;
  noteTa: string | null;
  inputs: unknown;
};

async function findActive(nameEn: string): Promise<Row | null> {
  return prisma.calculator.findFirst({
    where: { nameEn, active: true },
    select: {
      id: true,
      createdById: true,
      sortOrder: true,
      noteEn: true,
      noteTa: true,
      inputs: true,
    },
  });
}

function inputKeys(row: Row): string[] {
  return Array.isArray(row.inputs) ? (row.inputs as Array<{ key?: string }>).map((i) => i.key ?? "") : [];
}

async function replaceMealtimeDose(row: Row) {
  if (!inputKeys(row).includes("ic")) {
    console.log('  "Mealtime dose from carbohydrates" doesn\'t look like the old manual-IC ' + "version — leaving it alone.");
    return;
  }

  const inputs = [
    {
      key: "carbs",
      labelEn: "Carbohydrates in this meal",
      labelTa: "இந்த உணவில் உள்ள கார்போஹைட்ரேட்",
      unit: "g",
      min: 0,
      max: 500,
      decimals: 0,
    },
    {
      key: "tdd",
      labelEn: "Total daily insulin dose",
      labelTa: "மொத்த தினசரி இன்சுலின் அளவு",
      unit: "units",
      min: 1,
      max: 200,
      decimals: 1,
      helpEn:
        "Basal plus every mealtime dose in 24 hours. Filled in from your logged doses; you can change it.",
      helpTa:
        "24 மணி நேரத்தில் பேசல் மற்றும் அனைத்து உணவு நேர அளவுகளின் கூட்டுத்தொகை. பதிவு செய்த அளவுகளிலிருந்து நிரப்பப்படுகிறது; மாற்றலாம்.",
      source: "DATA",
      sourceKey: "insulin_total_daily_dose",
    },
  ];
  const outputs = [
    {
      key: "ic",
      labelEn: "Insulin-to-carb ratio (500 rule)",
      labelTa: "இன்சுலின்-கார்ப் விகிதம் (500 விதி)",
      unit: "g per unit",
      decimals: 1,
      expression: "500 / tdd",
    },
    {
      key: "meal",
      labelEn: "Insulin for this meal",
      labelTa: "இந்த உணவுக்கான இன்சுலின்",
      unit: "units",
      decimals: 1,
      expression: "carbs / ic",
    },
  ];

  const names = inputs.map((i) => i.key);
  for (const output of outputs) {
    const problem = validateFormula(output.expression, names);
    if (problem) throw new Error(`"Mealtime dose from carbohydrates" → ${output.key}: ${problem}`);
    names.push(output.key);
  }

  console.log(`  Replacing "Mealtime dose from carbohydrates" (${row.id})`);
  if (dryRun) return;

  await prisma.$transaction(async (tx) => {
    const created = await tx.calculator.create({
      data: {
        key: `mealtime-dose-from-carbohydrates-${Math.random().toString(36).slice(2, 8)}`,
        nameEn: "Mealtime dose from carbohydrates",
        nameTa: "கார்போஹைட்ரேட்டிலிருந்து உணவு நேர அளவு",
        descriptionEn:
          "How many units cover the carbohydrates in a meal, from carbs and your child's usual total daily dose.",
        descriptionTa:
          "ஒரு உணவில் உள்ள கார்போஹைட்ரேட்டையும் உங்கள் குழந்தையின் வழக்கமான மொத்த தினசரி அளவையும் கொண்டு, எத்தனை யூனிட் தேவை.",
        inputs,
        outputs,
        noteEn: row.noteEn,
        noteTa: row.noteTa,
        sortOrder: row.sortOrder,
        createdById: row.createdById,
      },
    });
    await tx.calculator.update({
      where: { id: row.id },
      data: { active: false, supersededById: created.id },
    });
  });
}

/** For "Correction dose for glucose before a meal" and "Total mealtime insulin" — both
 * replaced by two new rows (rapid/regular) created by the ordinary seed script under new
 * names, so this just deactivates the old one and points it at the rapid-acting variant. */
async function deactivateSupersededByName(oldNameEn: string, newRapidNameEn: string) {
  const row = await findActive(oldNameEn);
  if (!row) {
    console.log(`  No active "${oldNameEn}" — nothing to deactivate.`);
    return;
  }
  const replacement = await prisma.calculator.findFirst({
    where: { nameEn: newRapidNameEn, active: true },
    select: { id: true },
  });
  if (!replacement) {
    throw new Error(
      `"${newRapidNameEn}" doesn't exist yet — run scripts/seed-standard-calculators.ts first.`,
    );
  }

  console.log(`  Deactivating "${oldNameEn}" (${row.id}), superseded by "${newRapidNameEn}"`);
  if (dryRun) return;

  await prisma.calculator.update({
    where: { id: row.id },
    data: { active: false, supersededById: replacement.id },
  });
}

async function main() {
  console.log(dryRun ? "Dry run — nothing will be written.\n" : "");

  const mealtimeDose = await findActive("Mealtime dose from carbohydrates");
  if (mealtimeDose) {
    await replaceMealtimeDose(mealtimeDose);
  } else {
    console.log('  No active "Mealtime dose from carbohydrates" — nothing to replace.');
  }

  await deactivateSupersededByName(
    "Correction dose for glucose before a meal",
    "Correction dose — rapid-acting insulin",
  );
  await deactivateSupersededByName("Total mealtime insulin", "Total mealtime insulin — rapid-acting insulin");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

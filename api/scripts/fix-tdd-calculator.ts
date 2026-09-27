/**
 * Supersedes the live "Total daily dose (TDD)" calculator, which asked a
 * parent to type five separate numbers — basal, before breakfast, before
 * lunch, before dinner, "any other dose" — that add up to nothing the app
 * actually has: InsulinLog records what was taken and when, not which of
 * those five buckets it falls into, so every one of those fields sat blank
 * with nothing to fill it in and no way to check it against a real record.
 *
 * A calculator's own formula is immutable once created (see the model
 * comment on Calculator in prisma/schema.prisma, and the doc comment on
 * lib/services/calculators.ts) — fixing it means creating a corrected
 * calculator and pointing the old one's `supersededById` at it, exactly the
 * way the admin dashboard's own "replace this calculator" action does
 * (createCalculator, same file). That function can't be imported directly
 * from a plain script — it sits behind `import "server-only"` — so this
 * does the same two writes by hand: validate the one formula with the same
 * validateFormula() the dashboard itself uses, then create the replacement
 * and mark the old row superseded, in a transaction.
 *
 * scripts/seed-standard-calculators.ts has the fixed definition for
 * anything seeded fresh from now on; this is the one-time correction for an
 * environment whose database still has the old version active.
 *
 * Run with: npx tsx scripts/fix-tdd-calculator.ts [--dry-run]
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { validateFormula } from "../lib/utils/formula";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const dryRun = process.argv.includes("--dry-run");

const OLD_NAME_EN = "Total daily dose (TDD)";

const NEW_INPUTS = [
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

const NEW_OUTPUTS = [
  {
    key: "total",
    labelEn: "Total daily dose",
    labelTa: "மொத்த தினசரி அளவு",
    unit: "units",
    decimals: 1,
    expression: "tdd",
  },
];

async function main() {
  const problem = validateFormula(
    NEW_OUTPUTS[0].expression,
    NEW_INPUTS.map((i) => i.key),
  );
  if (problem) throw new Error(`Replacement formula is invalid: ${problem}`);

  const existing = await prisma.calculator.findFirst({
    where: { nameEn: OLD_NAME_EN, active: true },
    select: {
      id: true,
      createdById: true,
      sortOrder: true,
      noteEn: true,
      noteTa: true,
      inputs: true,
    },
  });

  if (!existing) {
    console.log(`No active "${OLD_NAME_EN}" calculator found — nothing to fix.`);
    return;
  }

  const inputKeys = Array.isArray(existing.inputs)
    ? (existing.inputs as Array<{ key?: string }>).map((i) => i.key)
    : [];
  if (!inputKeys.includes("basal")) {
    console.log(
      `The active "${OLD_NAME_EN}" calculator (${existing.id}) doesn't look like the old ` +
        "five-field version — leaving it alone rather than guessing.",
    );
    return;
  }

  console.log(`Found the old calculator: ${existing.id}`);
  console.log(dryRun ? "Dry run — nothing will be written.\n" : "");
  if (dryRun) return;

  const replacement = await prisma.$transaction(async (tx) => {
    const created = await tx.calculator.create({
      data: {
        key: `total-daily-dose-tdd-${Math.random().toString(36).slice(2, 8)}`,
        nameEn: OLD_NAME_EN,
        nameTa: "மொத்த தினசரி அளவு (TDD)",
        descriptionEn:
          "Your child's usual total daily insulin, averaged from the last week of logged doses — the same number the ratio and pump calculators start from.",
        descriptionTa:
          "உங்கள் குழந்தையின் வழக்கமான மொத்த தினசரி இன்சுலின், கடந்த வார பதிவு செய்த அளவுகளின் சராசரி — விகித மற்றும் பம்ப் கால்குலேட்டர்கள் பயன்படுத்தும் அதே எண்.",
        inputs: NEW_INPUTS,
        outputs: NEW_OUTPUTS,
        noteEn: existing.noteEn,
        noteTa: existing.noteTa,
        sortOrder: existing.sortOrder,
        createdById: existing.createdById,
      },
    });

    await tx.calculator.update({
      where: { id: existing.id },
      data: { active: false, supersededById: created.id },
    });

    return created;
  });

  console.log(`Created replacement calculator: ${replacement.id}`);
  console.log(`Superseded and deactivated: ${existing.id}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

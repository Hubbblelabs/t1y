/**
 * Seeds glucose, insulin and carbohydrate history for one existing demo
 * participant, from the 20th of the current month through today — enough
 * for every standard calculator's DATA-sourced inputs (glucose_latest,
 * insulin_total_daily_dose) to resolve to a real number instead of the
 * "Missing a value" error, so a coordinator trying out Calculators →
 * Run sees it actually work end to end.
 *
 * Picks the first ACTIVE participant it finds whose email ends in
 * @example.com (the demo families from prisma/seed.ts) — pass an email to
 * target a specific one instead.
 *
 * Idempotent: clears this participant's glucose/insulin/meal rows in the
 * date range first, so running it twice doesn't double the data.
 *
 * Run with: npx tsx scripts/seed-calculator-demo-data.ts [email]
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const REQUIRED_FEATURES = ["GLUCOSE_LOGGING", "INSULIN_LOGGING", "CARB_LOGGING"];

function atTime(day: Date, hours: number, minutes = 0): Date {
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** A gentle day-to-day wobble so every reading isn't identical. */
function jitter(base: number, spread: number): number {
  return Math.round((base + (Math.random() * 2 - 1) * spread) * 10) / 10;
}

/** The calendar date `day` actually represents, in local time — `toISOString`
 *  converts to UTC first, which mislabels it by a day west of UTC. */
function localDateLabel(day: Date): string {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function findParticipant(email?: string) {
  const user = await prisma.user.findFirst({
    where: {
      role: "PATIENT",
      deletedAt: null,
      status: "ACTIVE",
      ...(email ? { email } : { email: { endsWith: "@example.com" } }),
    },
    select: { id: true, name: true, email: true, profile: { select: { id: true, enabledFeatures: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    console.error(
      email
        ? `No active participant found with email ${email}.`
        : "No active demo participant (@example.com) found. Run prisma/seed.ts first, or pass an email.",
    );
    process.exit(1);
  }
  return user;
}

function dateRange(): Date[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 20);
  const days: Date[] = [];
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

async function main() {
  const emailArg = process.argv[2];
  const user = await findParticipant(emailArg);
  console.log(`Seeding calculator demo data for ${user.name} (${user.email})…\n`);

  if (user.profile) {
    const missing = REQUIRED_FEATURES.filter((f) => !user.profile!.enabledFeatures.includes(f));
    if (missing.length > 0) {
      await prisma.profile.update({
        where: { id: user.profile.id },
        data: { enabledFeatures: { push: missing } },
      });
      console.log(`  Enabled: ${missing.join(", ")}`);
    }
  }

  const days = dateRange();
  const from = days[0];
  const to = new Date(days[days.length - 1]);
  to.setHours(23, 59, 59, 999);

  await prisma.$transaction([
    prisma.glucoseReading.deleteMany({ where: { userId: user.id, measuredAt: { gte: from, lte: to } } }),
    prisma.insulinLog.deleteMany({ where: { userId: user.id, administeredAt: { gte: from, lte: to } } }),
    prisma.meal.deleteMany({ where: { userId: user.id, consumedAt: { gte: from, lte: to } } }),
  ]);

  for (const day of days) {
    await prisma.glucoseReading.createMany({
      data: [
        { userId: user.id, value: jitter(95, 10), context: "FASTING", measuredAt: atTime(day, 7, 0) },
        { userId: user.id, value: jitter(140, 15), context: "PRE_MEAL", measuredAt: atTime(day, 12, 30) },
        { userId: user.id, value: jitter(150, 15), context: "PRE_MEAL", measuredAt: atTime(day, 19, 0) },
        { userId: user.id, value: jitter(120, 10), context: "BEDTIME", measuredAt: atTime(day, 22, 0) },
      ],
    });

    await prisma.insulinLog.createMany({
      data: [
        {
          userId: user.id,
          insulinName: "Lantus",
          insulinType: "LONG_ACTING",
          doseUnits: jitter(10, 1),
          administeredAt: atTime(day, 7, 15),
          mealAssociation: "NONE",
        },
        {
          userId: user.id,
          insulinName: "Novorapid",
          insulinType: "RAPID_ACTING",
          doseUnits: jitter(4, 1),
          administeredAt: atTime(day, 7, 45),
          mealAssociation: "BEFORE_MEAL",
        },
        {
          userId: user.id,
          insulinName: "Novorapid",
          insulinType: "RAPID_ACTING",
          doseUnits: jitter(5, 1),
          administeredAt: atTime(day, 12, 45),
          mealAssociation: "BEFORE_MEAL",
        },
        {
          userId: user.id,
          insulinName: "Novorapid",
          insulinType: "RAPID_ACTING",
          doseUnits: jitter(6, 1),
          administeredAt: atTime(day, 19, 15),
          mealAssociation: "BEFORE_MEAL",
        },
      ],
    });

    await prisma.meal.createMany({
      data: [
        {
          userId: user.id,
          mealType: "BREAKFAST",
          consumedAt: atTime(day, 7, 30),
          totalCarbsGrams: jitter(45, 8),
        },
        {
          userId: user.id,
          mealType: "LUNCH",
          consumedAt: atTime(day, 12, 40),
          totalCarbsGrams: jitter(60, 10),
        },
        {
          userId: user.id,
          mealType: "DINNER",
          consumedAt: atTime(day, 19, 10),
          totalCarbsGrams: jitter(55, 10),
        },
      ],
    });

    console.log(`  ✓ ${localDateLabel(day)}: 4 glucose, 4 insulin, 3 meals`);
  }

  console.log(
    `\nDone. ${days.length} day(s) seeded (${localDateLabel(from)} → ${localDateLabel(days[days.length - 1])}).`,
  );
  console.log(
    `Run any standard calculator (Calculators → a calculator → Run) for ${user.name} to see it filled in.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

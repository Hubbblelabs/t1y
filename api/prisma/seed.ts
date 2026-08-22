import "dotenv/config";

import { randomUUID, scryptSync, randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import type {
  DiabetesType,
  ExerciseCategory,
  ExerciseIntensity,
  GlucoseContext,
  MealType,
  MedicationLogStatus,
  UserRole,
} from "../generated/prisma/enums";

/**
 * Development seed data.
 *
 * IMPORTANT: every participant below is fabricated. No real person's health
 * information is used, and none should ever be added to this file.
 *
 * The generated values are plausible but deliberately synthetic — they exist so
 * the dashboard has something to render, not to model any clinical reality.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "ChangeMe!2024";

/**
 * Deterministic pseudo-random generator.
 *
 * Seeding twice produces the same cohort, which makes screenshots, tests and
 * bug reports reproducible.
 */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const random = createRandom(20_260_809);

function between(min: number, max: number, decimals = 0): number {
  const value = min + random() * (max - min);
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

function daysAgo(days: number, hour = 8, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** A birth date landing the participant somewhere in the 6–15 inclusion band today. */
function childBirthDate(seed: number): Date {
  const ageYears = 6 + (seed % 10); // 6..15
  const date = new Date();
  date.setFullYear(date.getFullYear() - ageYears);
  date.setMonth(seed % 12, 1 + (seed % 27));
  return date;
}

/** Calendar year of a diagnosis that occurred [monthsAgo] months before today. */
function diagnosisYearMonthsAgo(monthsAgo: number): number {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  return date.getFullYear();
}

/**
 * Better Auth's scrypt password format.
 *
 * Matches `better-auth`'s default hasher (scrypt, N=16384 r=16 p=1, 64-byte
 * key, stored as `salt:hex`) so seeded accounts can sign in normally.
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password.normalize("NFKC"), salt, 64, {
    N: 16_384,
    r: 16,
    p: 1,
    maxmem: 128 * 16_384 * 16 * 2,
  });
  return `${salt}:${key.toString("hex")}`;
}

async function createAccount(params: {
  email: string;
  name: string;
  role: UserRole;
  timezone?: string;
  password?: string;
}) {
  const user = await prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      role: params.role,
      status: "ACTIVE",
      emailVerified: true,
      timezone: params.timezone ?? "Asia/Kolkata",
      accounts: {
        create: {
          accountId: randomUUID(),
          providerId: "credential",
          password: hashPassword(params.password ?? DEFAULT_PASSWORD),
        },
      },
    },
    select: { id: true, email: true, role: true },
  });

  return user;
}

// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Amara", "Bilal", "Chen", "Dara", "Elena", "Farid", "Grace", "Hiro",
  "Ines", "Jonas", "Kayla", "Liam", "Mira", "Noor", "Omar", "Priya",
  "Quinn", "Rosa", "Sami", "Tomas", "Uma", "Viktor", "Wren", "Yusuf",
];

const LAST_NAMES = [
  "Adeyemi", "Baros", "Chowdhury", "Delgado", "Eriksen", "Fontaine",
  "Gallagher", "Haddad", "Ibrahim", "Jensen", "Kowalski", "Lindqvist",
  "Moreau", "Nakamura", "Okafor", "Petrov", "Rahman", "Silva",
  "Tanaka", "Ueno", "Vargas", "Whitfield", "Xiong", "Zielinski",
];

// This study's inclusion criteria (BRD §1.1) is Type 1 diabetes only —
// children aged 6–15, diagnosed 6–12 months prior. The seed previously drew
// from a generic multi-condition pool (mostly TYPE_2/PREDIABETES/GESTATIONAL,
// adults aged 23–71) inherited from the platform's original non-study scope.
// That produced an admin participant list where 23 of 24 "patients" didn't
// match who this app is actually for. Every seeded participant is now
// TYPE_1, matching the only type the study — and the imported curriculum —
// is about.
const DIABETES_TYPES: DiabetesType[] = ["TYPE_1"];

const GLUCOSE_CONTEXTS: GlucoseContext[] = [
  "FASTING", "PRE_MEAL", "POST_MEAL", "BEDTIME", "RANDOM",
];

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

const ACTIVITIES: Array<{ name: string; category: ExerciseCategory }> = [
  { name: "Walking", category: "WALKING" },
  { name: "Cycling", category: "AEROBIC" },
  { name: "Swimming", category: "AEROBIC" },
  { name: "Resistance training", category: "STRENGTH" },
  { name: "Yoga", category: "YOGA" },
  { name: "Stretching", category: "FLEXIBILITY" },
  { name: "Breathing exercise", category: "BREATHING" },
];

const INTENSITIES: ExerciseIntensity[] = ["LIGHT", "MODERATE", "VIGOROUS"];

async function main() {
  console.log("Seeding development data…");

  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`Database already contains ${existing} users. Skipping seed.`);
    console.log("Reset the database first if you want a clean seed.");
    return;
  }

  // -------------------------------------------------------------------------
  // Staff accounts
  // -------------------------------------------------------------------------
  // Only staff role now is ADMIN (see lib/permissions/roles.ts) — this
  // deployment serves one study with one operating team, not the platform's
  // original multi-role newsroom of super-admins/researchers/reviewers.
  const teamAdmin = await createAccount({
    email: "teammistake@gmail.com",
    name: "Team Mistake",
    role: "ADMIN",
    password: "User@123456789",
  });
  await prisma.adminUser.create({
    data: {
      userId: teamAdmin.id,
      jobTitle: "Product",
      department: "Engineering",
      organization: "Mistake Technologies",
    },
  });

  console.log("  ✓ 1 staff account");

  // -------------------------------------------------------------------------
  // Health metric definitions — metrics are rows, not columns
  // -------------------------------------------------------------------------
  const metricDefinitions = await Promise.all(
    [
      {
        key: "weight",
        label: "Weight",
        unit: "kg",
        valueType: "NUMERIC" as const,
        minValue: 20,
        maxValue: 400,
        precision: 1,
        sortOrder: 1,
      },
      {
        key: "blood_pressure",
        label: "Blood pressure",
        unit: "mmHg",
        valueType: "COMPOSITE" as const,
        primaryLabel: "Systolic",
        secondaryLabel: "Diastolic",
        minValue: 40,
        maxValue: 260,
        precision: 0,
        sortOrder: 2,
      },
      {
        key: "heart_rate",
        label: "Heart rate",
        unit: "bpm",
        valueType: "NUMERIC" as const,
        minValue: 25,
        maxValue: 240,
        precision: 0,
        sortOrder: 3,
      },
      {
        key: "bmi",
        label: "BMI",
        unit: "kg/m²",
        valueType: "NUMERIC" as const,
        minValue: 8,
        maxValue: 90,
        precision: 1,
        sortOrder: 4,
      },
    ].map((definition) =>
      prisma.healthMetricDefinition.create({ data: definition }),
    ),
  );

  const weightDefinition = metricDefinitions.find((d) => d.key === "weight")!;
  const bpDefinition = metricDefinitions.find((d) => d.key === "blood_pressure")!;

  console.log("  ✓ 4 health metric definitions");

  // -------------------------------------------------------------------------
  // Exercise catalogue
  // -------------------------------------------------------------------------
  await prisma.exercise.createMany({
    data: ACTIVITIES.map((activity) => ({
      name: activity.name,
      category: activity.category,
      isSystem: true,
    })),
  });

  // -------------------------------------------------------------------------
  // Participants and their health history
  // -------------------------------------------------------------------------
  const PARTICIPANT_COUNT = 24;
  const participantIds: string[] = [];

  for (let index = 0; index < PARTICIPANT_COUNT; index += 1) {
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(index * 7) % LAST_NAMES.length]!;
    const code = `P${String(index + 1).padStart(4, "0")}`;
    const diabetesType = pick(DIABETES_TYPES);

    // A few accounts are left inactive or pending so the status filters have
    // something to show.
    const status =
      index === 22 ? "INACTIVE" : index === 23 ? "PENDING" : "ACTIVE";

    const joinedDaysAgo = between(20, 200);

    const user = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        name: `${firstName} ${lastName}`,
        role: "PATIENT",
        status,
        emailVerified: status !== "PENDING",
        timezone: "Asia/Kolkata",
        createdAt: daysAgo(joinedDaysAgo),
        accounts: {
          create: {
            accountId: randomUUID(),
            providerId: "credential",
            password: hashPassword(DEFAULT_PASSWORD),
          },
        },
        profile: {
          create: {
            participantCode: code,
            firstName,
            lastName,
            // Ages 6–15, per the inclusion criteria — was drawing adult
            // birth years (1955–2003).
            dateOfBirth: childBirthDate(index),
            sex: pick(["FEMALE", "MALE", "PREFER_NOT_TO_SAY"] as const),
            phone: `+91 9${String(400000000 + index * 137).slice(0, 9)}`,
            city: pick(["Coimbatore", "Tiruppur", "Erode", "Salem", "Pollachi"]),
            country: "India",
            diabetesType,
            // "Diagnosed 6–12 months prior" per the inclusion criteria — was
            // drawing any year 2005–2024 regardless of type.
            diagnosisYear: diagnosisYearMonthsAgo(between(6, 12)),
            treatmentModality: "INSULIN",
            // Paediatric ranges (WHO growth reference, ages 6–15) — was
            // drawing adult height/weight (152–191cm, 58–112kg).
            heightCm: between(112, 168, 0),
            baselineWeightKg: between(18, 58, 1),
            onboardedAt: status === "PENDING" ? null : daysAgo(joinedDaysAgo - 1),
          },
        },
      },
      select: { id: true },
    });

    participantIds.push(user.id);

    if (status === "PENDING") continue; // no history for an unactivated account

    const historyDays = Math.min(90, Math.round(joinedDaysAgo));

    // --- Glucose ------------------------------------------------------------
    const glucoseRows: Array<{
      userId: string;
      value: number;
      unit: "MG_DL";
      context: GlucoseContext;
      measuredAt: Date;
      source: "MANUAL";
    }> = [];

    // A per-participant baseline keeps each person's series internally coherent.
    const baseline = between(95, 165);

    for (let day = historyDays; day >= 0; day -= 1) {
      const readingsToday = Math.round(between(0, 4));
      for (let reading = 0; reading < readingsToday; reading += 1) {
        const context = pick(GLUCOSE_CONTEXTS);
        const offset =
          context === "POST_MEAL" ? between(15, 60) : context === "FASTING" ? between(-20, 5) : between(-10, 30);

        glucoseRows.push({
          userId: user.id,
          value: Math.max(45, Math.round(baseline + offset + between(-18, 18))),
          unit: "MG_DL",
          context,
          measuredAt: daysAgo(day, Math.round(between(6, 22)), Math.round(between(0, 59))),
          source: "MANUAL",
        });
      }
    }
    if (glucoseRows.length > 0) {
      await prisma.glucoseReading.createMany({ data: glucoseRows });
    }

    // --- Medications and adherence -----------------------------------------
    const medicationName =
      diabetesType === "TYPE_1" ? "Insulin glargine" : "Metformin";
    const medication = await prisma.medication.create({
      data: {
        userId: user.id,
        name: medicationName,
        genericName: medicationName.toLowerCase(),
        dosageText: diabetesType === "TYPE_1" ? "20 units" : "500 mg",
        form: diabetesType === "TYPE_1" ? "INJECTION" : "TABLET",
        frequency: "Twice daily",
        timesPerDay: 2,
        scheduleTimes: ["08:00", "20:00"],
        startDate: daysAgo(historyDays),
        isActive: true,
        prescribedBy: "Dr Marcus Bell",
      },
      select: { id: true },
    });

    // Adherence varies by participant so the cohort figure is not uniform.
    const adherenceRate = between(0.62, 0.98, 2);
    const logs: Array<{
      userId: string;
      medicationId: string;
      scheduledFor: Date;
      takenAt: Date | null;
      status: MedicationLogStatus;
    }> = [];

    for (let day = Math.min(historyDays, 45); day >= 1; day -= 1) {
      for (const hour of [8, 20]) {
        const roll = random();
        const scheduledFor = daysAgo(day, hour);
        const outcome: MedicationLogStatus =
          roll < adherenceRate ? "TAKEN" : roll < adherenceRate + 0.06 ? "SKIPPED" : "MISSED";

        logs.push({
          userId: user.id,
          medicationId: medication.id,
          scheduledFor,
          takenAt:
            outcome === "TAKEN"
              ? new Date(scheduledFor.getTime() + between(0, 45) * 60_000)
              : null,
          status: outcome,
        });
      }
    }
    await prisma.medicationLog.createMany({ data: logs, skipDuplicates: true });

    // --- Insulin ------------------------------------------------------------
    if (diabetesType === "TYPE_1" || random() < 0.25) {
      const insulinRows = [];
      for (let day = Math.min(historyDays, 30); day >= 1; day -= 1) {
        insulinRows.push({
          userId: user.id,
          insulinName: "Insulin glargine",
          insulinType: "LONG_ACTING" as const,
          doseUnits: between(12, 28, 0),
          administeredAt: daysAgo(day, 22),
          injectionSite: pick(["ABDOMEN", "LEFT_THIGH", "RIGHT_THIGH", "LEFT_ARM"] as const),
          mealAssociation: "BEDTIME" as const,
        });
      }
      await prisma.insulinLog.createMany({ data: insulinRows });
    }

    // --- Meals --------------------------------------------------------------
    for (let day = Math.min(historyDays, 21); day >= 1; day -= 1) {
      const mealsToday = Math.round(between(1, 3));
      for (let meal = 0; meal < mealsToday; meal += 1) {
        const mealType = MEAL_TYPES[meal % MEAL_TYPES.length]!;
        await prisma.meal.create({
          data: {
            userId: user.id,
            mealType,
            consumedAt: daysAgo(day, 7 + meal * 5),
            totalCarbsGrams: between(18, 85, 1),
            totalCalories: between(220, 780, 0),
            totalProteinGrams: between(8, 42, 1),
            // Most entries are self-reported; a minority reference a database.
            nutritionSource: random() < 0.25 ? "McCance & Widdowson (7th ed.)" : null,
            items: {
              create: [
                {
                  name: pick([
                    "Porridge with berries",
                    "Wholegrain sandwich",
                    "Grilled chicken salad",
                    "Lentil soup",
                    "Rice and vegetables",
                    "Greek yoghurt",
                  ]),
                  quantity: 1,
                  unit: "serving",
                  carbsGrams: between(15, 60, 1),
                },
              ],
            },
          },
        });
      }
    }

    // --- Exercise -----------------------------------------------------------
    const exerciseRows = [];
    for (let day = Math.min(historyDays, 60); day >= 1; day -= 1) {
      if (random() > 0.45) continue; // rest days
      const activity = pick(ACTIVITIES);
      exerciseRows.push({
        userId: user.id,
        activityName: activity.name,
        category: activity.category,
        durationMinutes: Math.round(between(15, 75)),
        intensity: pick(INTENSITIES),
        distanceKm: activity.category === "WALKING" ? between(1.5, 8, 2) : null,
        steps: activity.category === "WALKING" ? Math.round(between(2000, 11000)) : null,
        performedAt: daysAgo(day, Math.round(between(6, 20))),
      });
    }
    if (exerciseRows.length > 0) {
      await prisma.exerciseLog.createMany({ data: exerciseRows });
    }

    // --- HbA1c --------------------------------------------------------------
    // Quarterly results, drifting slightly so the trend chart has shape.
    let hba1c = between(6.2, 9.4, 1);
    const hba1cRows = [];
    for (const day of [270, 180, 90, 10]) {
      if (day > joinedDaysAgo) continue;
      hba1c = Math.max(5.2, Math.min(12, hba1c + between(-0.5, 0.35, 1)));
      hba1cRows.push({
        userId: user.id,
        valuePercent: Number(hba1c.toFixed(1)),
        valueMmolMol: Number(((hba1c - 2.15) * 10.929).toFixed(1)),
        measuredAt: daysAgo(day, 10),
        source: "LABORATORY" as const,
        laboratoryName: "Example Regional Laboratory",
      });
    }
    if (hba1cRows.length > 0) {
      await prisma.hbA1cRecord.createMany({ data: hba1cRows, skipDuplicates: true });
    }

    // --- Health metrics -----------------------------------------------------
    let weight = between(62, 108, 1);
    const metricRows = [];
    for (let week = Math.floor(Math.min(historyDays, 84) / 7); week >= 0; week -= 1) {
      weight = Math.max(45, weight + between(-0.8, 0.6, 1));
      metricRows.push({
        userId: user.id,
        definitionId: weightDefinition.id,
        value: Number(weight.toFixed(1)),
        unit: "kg",
        measuredAt: daysAgo(week * 7, 7),
        source: "MANUAL" as const,
      });
      metricRows.push({
        userId: user.id,
        definitionId: bpDefinition.id,
        value: Math.round(between(108, 148)),
        secondaryValue: Math.round(between(66, 94)),
        unit: "mmHg",
        measuredAt: daysAgo(week * 7, 8),
        source: "MANUAL" as const,
      });
    }
    await prisma.healthMetric.createMany({ data: metricRows });

    // --- Reminders ----------------------------------------------------------
    //
    // The previous "Time for your medication" reminder was removed: nothing
    // in the study's source documents covers a scheduled oral-medication
    // dose (the only occurrence of "medication" across all eight documents
    // is incidental — terbutaline raising blood glucose). It pointed at the
    // Medication model, which api/docs/UNUSED-BACKEND.md already flags as a
    // Type 2 concept wrong for a Type 1 paediatric app, and told the parent
    // to "record this dose" in a logging screen that does not exist in v1.
    //
    // These two are grounded in the curriculum instead: self-monitoring of
    // blood glucose (the SMBG document) and HbA1c, which the annual check-up
    // document says should be tested 3–4 times a year.
    await prisma.reminder.createMany({
      data: [
        {
          userId: user.id,
          type: "GLUCOSE_REMINDER",
          title: "Check blood glucose",
          body: "Record today's reading before breakfast.",
          timeOfDay: "08:00",
          recurrence: "DAILY",
          daysOfWeek: [],
          timezone: "Asia/Kolkata",
          enabled: true,
        },
        {
          userId: user.id,
          type: "HBA1C_REMINDER",
          title: "HbA1c test due",
          body: "HbA1c is checked 3–4 times a year. Ask your diabetes team.",
          timeOfDay: "09:00",
          recurrence: "MONTHLY",
          daysOfWeek: [],
          dayOfMonth: 1,
          timezone: "Asia/Kolkata",
          enabled: true,
        },
      ],
    });

    // Keep participant lists sortable by recency.
    await prisma.profile.update({
      where: { userId: user.id },
      data: { lastActivityAt: daysAgo(Math.round(between(0, 6))) },
    });
  }

  console.log(`  ✓ ${PARTICIPANT_COUNT} participants with health history`);

  // No study enrolment block: it existed to demonstrate researcher-scoped
  // visibility (StudyParticipant/StudyAccess), a distinction that no longer
  // exists now that RESEARCHER isn't a role (see lib/permissions/roles.ts).

  // -------------------------------------------------------------------------
  // Education content
  // -------------------------------------------------------------------------
  //
  // DISABLED — these six generic placeholder articles predate the study and
  // are English-only. Because the Help Book collapses by slug and falls back
  // to English for any topic with no Tamil row, seeding them made the Tamil
  // Help Book render as an alternating EN/TA list: the eight real curriculum
  // topics in Tamil, interleaved (by sortOrder 0-5) with these six stuck in
  // English. The real content comes from `scripts/import-content.ts`, which
  // imports all eight topics in both locales from `content/docx/`.
  //
  // Kept rather than deleted so the shape is on record if a future non-study
  // deployment ever wants demo articles — but it must not run for this study.
  const SEED_PLACEHOLDER_ARTICLES = false;

  const articles = [
    {
      slug: "understanding-blood-glucose",
      title: "Understanding blood glucose readings",
      category: "GLUCOSE_MANAGEMENT" as const,
      description: "What a glucose reading represents and when readings are usually taken.",
      body: "<p>A blood glucose reading records the amount of glucose in your blood at a single moment. Readings taken at different times — before a meal, after a meal, or before bed — are not directly comparable.</p><p>Your care team will tell you which readings matter for you and how often to take them.</p>",
    },
    {
      slug: "getting-started-with-tracking",
      title: "Getting started with tracking",
      category: "DIABETES_BASICS" as const,
      description: "How to build a consistent logging habit in the first few weeks.",
      body: "<p>Consistent records help you and your care team see patterns over time. Start with one thing — glucose readings, or medication — and add more once it feels routine.</p>",
    },
    {
      slug: "taking-medication-consistently",
      title: "Taking your medication consistently",
      category: "MEDICATION" as const,
      description: "Practical strategies for remembering doses.",
      body: "<p>Missing an occasional dose is common. Reminders, pairing doses with an existing daily habit, and a weekly pill organiser all help.</p><p>If you are frequently missing doses, tell your care team — the schedule may be adjustable.</p>",
    },
    {
      slug: "carbohydrates-and-meals",
      title: "Carbohydrates and meals",
      category: "NUTRITION" as const,
      description: "Why carbohydrate content is worth recording.",
      body: "<p>Carbohydrates have the largest short-term effect on blood glucose. Recording roughly how much you eat helps you and your care team interpret your readings.</p><p>Estimates are useful even when they are not precise.</p>",
    },
    {
      slug: "moving-more-safely",
      title: "Moving more, safely",
      category: "EXERCISE" as const,
      description: "Building activity into your week.",
      body: "<p>Activity of any intensity counts. Build up gradually and speak to your care team before starting something substantially more strenuous than your usual routine.</p>",
    },
    {
      slug: "managing-everyday-stress",
      title: "Managing everyday stress",
      category: "STRESS_MANAGEMENT" as const,
      description: "Simple techniques you can use anywhere.",
      body: "<p>Stress affects sleep, appetite and motivation. Short breathing exercises, a regular sleep schedule and time outdoors are all reasonable places to start.</p>",
    },
  ];

  if (SEED_PLACEHOLDER_ARTICLES) {
    for (const [index, article] of articles.entries()) {
      await prisma.educationContent.create({
        data: {
          ...article,
          body: article.body,
          externalReferences: [],
          tags: [article.category.toLowerCase().replace(/_/g, "-")],
          status: index < 5 ? "PUBLISHED" : "DRAFT",
          publishedAt: index < 5 ? daysAgo(60 - index * 5) : null,
          readingTimeMinutes: 3,
          sortOrder: index,
          authorId: teamAdmin.id,
        },
      });
    }
    console.log(`  ✓ ${articles.length} education articles`);
  } else {
    console.log("  – placeholder education articles skipped (study uses import-content.ts)");
  }

  // No exercise-programme, notification-campaign or demo-audit-log blocks:
  // all three were fabricated filler for the platform's original generic
  // scope (ExerciseContent, NotificationCampaign, and audit rows that quoted
  // the now-deleted demo study and researcher@example.com). None of it came
  // from the study's source documents, and it was already removed from the
  // live database for the same reason — see the DB cleanup covered earlier
  // in this conversation.

  console.log("\nSeed complete.\n");
  console.log("  Sign in at /admin/login with:");
  console.log("    teammistake@gmail.com   (Administrator)");
  console.log(`  Password: User@123456789`);
  console.log("\n  All participant data above is fabricated.\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

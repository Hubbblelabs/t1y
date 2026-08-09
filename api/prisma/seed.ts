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
}) {
  const user = await prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      role: params.role,
      status: "ACTIVE",
      emailVerified: true,
      timezone: params.timezone ?? "Europe/London",
      accounts: {
        create: {
          accountId: randomUUID(),
          providerId: "credential",
          password: hashPassword(DEFAULT_PASSWORD),
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

const DIABETES_TYPES: DiabetesType[] = [
  "TYPE_1", "TYPE_2", "TYPE_2", "TYPE_2", "GESTATIONAL", "PREDIABETES",
];

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
  const superAdmin = await createAccount({
    email: "super.admin@example.com",
    name: "Sofia Almeida",
    role: "SUPER_ADMIN",
  });
  await prisma.adminUser.create({
    data: {
      userId: superAdmin.id,
      jobTitle: "Platform lead",
      department: "Operations",
      organization: "Example Health",
    },
  });

  const admin = await createAccount({
    email: "admin@example.com",
    name: "Daniel Okonkwo",
    role: "ADMIN",
  });
  await prisma.adminUser.create({
    data: {
      userId: admin.id,
      jobTitle: "Programme administrator",
      department: "Operations",
      organization: "Example Health",
    },
  });

  const researcher = await createAccount({
    email: "researcher@example.com",
    name: "Dr Hannah Weiss",
    role: "RESEARCHER",
  });
  await prisma.adminUser.create({
    data: {
      userId: researcher.id,
      jobTitle: "Research fellow",
      department: "Clinical research",
      organization: "Example University",
    },
  });

  const reviewer = await createAccount({
    email: "reviewer@example.com",
    name: "Dr Marcus Bell",
    role: "CLINICAL_REVIEWER",
  });
  await prisma.adminUser.create({
    data: {
      userId: reviewer.id,
      jobTitle: "Consultant diabetologist",
      department: "Clinical oversight",
      organization: "Example Health",
    },
  });

  console.log("  ✓ 4 staff accounts");

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
  // Research study
  // -------------------------------------------------------------------------
  const study = await prisma.researchStudy.create({
    data: {
      code: "DM01",
      title: "Self-management engagement and glycaemic tracking",
      description:
        "An observational study of engagement with digital self-management tools.",
      objective:
        "Describe the relationship between logging frequency and recorded HbA1c over 12 months.",
      status: "ACTIVE",
      principalInvestigator: "Dr Hannah Weiss",
      irbNumber: "IRB-2026-0142",
      consentVersion: "v2.1",
      startDate: daysAgo(180),
      targetEnrollment: 40,
      dataPoints: ["glucose", "medication", "exercise", "hba1c", "health-metrics"],
      createdById: superAdmin.id,
    },
  });

  // The researcher can only see participants in studies granted to them.
  await prisma.studyAccess.create({
    data: {
      studyId: study.id,
      userId: researcher.id,
      role: "LEAD_INVESTIGATOR",
      canExport: true,
      grantedById: superAdmin.id,
    },
  });

  console.log("  ✓ 1 research study with researcher access");

  // -------------------------------------------------------------------------
  // Clinical thresholds
  //
  // Seeded WITH provenance, and only values that come from a published
  // guideline. The application itself never invents these.
  // -------------------------------------------------------------------------
  await prisma.clinicalThreshold.createMany({
    data: [
      {
        key: "glucose.fasting.target",
        scope: "GLOBAL",
        domain: "glucose",
        context: "FASTING",
        unit: "mg/dL",
        lowValue: 80,
        highValue: 130,
        label: "Fasting glucose target range",
        source:
          "ADA Standards of Care 2024, preprandial capillary plasma glucose target for non-pregnant adults. Review before clinical use.",
        createdById: reviewer.id,
      },
      {
        key: "glucose.postmeal.target",
        scope: "GLOBAL",
        domain: "glucose",
        context: "POST_MEAL",
        unit: "mg/dL",
        highValue: 180,
        label: "Post-meal glucose target",
        source:
          "ADA Standards of Care 2024, peak postprandial capillary plasma glucose for non-pregnant adults. Review before clinical use.",
        createdById: reviewer.id,
      },
      {
        key: "hba1c.general.target",
        scope: "GLOBAL",
        domain: "hba1c",
        unit: "%",
        highValue: 7,
        label: "General HbA1c target",
        source:
          "ADA Standards of Care 2024, general target for many non-pregnant adults. Individualisation is required.",
        createdById: reviewer.id,
      },
    ],
  });

  console.log("  ✓ 3 clinical thresholds (each with a stated source)");

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
        timezone: "Europe/London",
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
            dateOfBirth: new Date(
              `${between(1955, 2003)}-0${between(1, 9)}-1${between(0, 8)}`,
            ),
            sex: pick(["FEMALE", "MALE", "PREFER_NOT_TO_SAY"] as const),
            phone: `+44 7700 9${String(100000 + index).slice(0, 5)}`,
            city: pick(["London", "Manchester", "Leeds", "Bristol", "Glasgow"]),
            country: "United Kingdom",
            diabetesType,
            diagnosisYear: Math.round(between(2005, 2024)),
            treatmentModality:
              diabetesType === "TYPE_1"
                ? "INSULIN"
                : pick(["ORAL_MEDICATION", "LIFESTYLE_ONLY", "ORAL_AND_INSULIN"] as const),
            heightCm: between(152, 191, 0),
            baselineWeightKg: between(58, 112, 1),
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
    await prisma.reminder.create({
      data: {
        userId: user.id,
        type: "MEDICATION_REMINDER",
        title: "Time for your medication",
        // No measurement in the body — push previews show on lock screens.
        body: "Open the app to record this dose.",
        timeOfDay: "08:00",
        recurrence: "DAILY",
        daysOfWeek: [],
        timezone: "Europe/London",
        medicationId: medication.id,
        enabled: true,
      },
    });

    // Keep participant lists sortable by recency.
    await prisma.profile.update({
      where: { userId: user.id },
      data: { lastActivityAt: daysAgo(Math.round(between(0, 6))) },
    });
  }

  console.log(`  ✓ ${PARTICIPANT_COUNT} participants with health history`);

  // -------------------------------------------------------------------------
  // Study enrolment — a subset, so scoping is observable
  // -------------------------------------------------------------------------
  const enrolled = participantIds.slice(0, 14);
  for (const [index, userId] of enrolled.entries()) {
    await prisma.studyParticipant.create({
      data: {
        studyId: study.id,
        userId,
        studyParticipantCode: `DM01-${String(index + 1).padStart(4, "0")}`,
        enrollmentStatus: index < 12 ? "ACTIVE" : "WITHDRAWN",
        armOrGroup: index % 2 === 0 ? "Intervention" : "Control",
        consentGivenAt: daysAgo(150),
        enrolledAt: daysAgo(150),
        ...(index >= 12
          ? { withdrawnAt: daysAgo(30), withdrawalReason: "Relocated" }
          : {}),
      },
    });
  }

  console.log(`  ✓ ${enrolled.length} study enrolments`);

  // -------------------------------------------------------------------------
  // Education content
  // -------------------------------------------------------------------------
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
        authorId: admin.id,
      },
    });
  }

  console.log(`  ✓ ${articles.length} education articles`);

  // -------------------------------------------------------------------------
  // Exercise programmes
  // -------------------------------------------------------------------------
  const programmes = [
    {
      slug: "morning-breathing",
      title: "Morning breathing",
      description: "A short breathing routine to start the day.",
      category: "BREATHING" as const,
      difficulty: "BEGINNER" as const,
      durationMinutes: 10,
      instructions:
        "<p>Sit comfortably with your back supported.</p><ol><li>Breathe in through your nose for four counts.</li><li>Hold for two counts.</li><li>Breathe out slowly for six counts.</li></ol><p>Repeat for ten minutes. Stop if you feel light-headed.</p>",
      equipment: [],
    },
    {
      slug: "gentle-walking-plan",
      title: "Gentle walking plan",
      description: "A structured walking routine that builds up over four weeks.",
      category: "WALKING" as const,
      difficulty: "BEGINNER" as const,
      durationMinutes: 20,
      instructions:
        "<p>Start with 20 minutes at a comfortable pace, three times a week. Add five minutes each week.</p><p>You should be able to hold a conversation while walking.</p>",
      equipment: ["Comfortable footwear"],
    },
    {
      slug: "seated-strength",
      title: "Seated strength routine",
      description: "Resistance exercises that can be done from a chair.",
      category: "STRENGTH" as const,
      difficulty: "INTERMEDIATE" as const,
      durationMinutes: 25,
      instructions:
        "<p>Complete two rounds of each movement, resting a minute between rounds.</p><p>Stop any movement that causes pain.</p>",
      equipment: ["Sturdy chair", "Resistance band"],
      precautions:
        "Speak to your care team before starting if you have diabetic retinopathy or neuropathy.",
    },
  ];

  for (const [index, programme] of programmes.entries()) {
    await prisma.exerciseContent.create({
      data: {
        ...programme,
        status: "PUBLISHED",
        publishedAt: daysAgo(45 - index * 5),
        sortOrder: index,
        authorId: admin.id,
      },
    });
  }

  console.log(`  ✓ ${programmes.length} exercise programmes`);

  // -------------------------------------------------------------------------
  // A sent notification campaign
  // -------------------------------------------------------------------------
  const campaign = await prisma.notificationCampaign.create({
    data: {
      title: "New education article available",
      body: "A new article on understanding your readings is now available in the app.",
      type: "EDUCATION",
      status: "SENT",
      targetType: "ALL_PARTICIPANTS",
      targetUserIds: [],
      sentAt: daysAgo(5),
      totalRecipients: participantIds.length,
      deliveredCount: participantIds.length,
      createdById: admin.id,
    },
  });

  await prisma.notification.createMany({
    data: participantIds.map((userId) => ({
      userId,
      campaignId: campaign.id,
      type: "EDUCATION" as const,
      title: campaign.title,
      body: campaign.body,
      status: "SENT" as const,
      sentAt: daysAgo(5),
    })),
  });

  console.log("  ✓ 1 notification campaign");

  // -------------------------------------------------------------------------
  // A little audit history, so the page is not empty on first load
  // -------------------------------------------------------------------------
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: superAdmin.id,
        actorEmail: "super.admin@example.com",
        actorRole: "SUPER_ADMIN",
        action: "study.created",
        resourceType: "study",
        resourceId: study.id,
        studyId: study.id,
        description: `Created study DM01`,
        ipAddress: "203.0.113.10",
      },
      {
        actorId: superAdmin.id,
        actorEmail: "super.admin@example.com",
        actorRole: "SUPER_ADMIN",
        action: "study.access_granted",
        resourceType: "study-access",
        studyId: study.id,
        description: "Granted LEAD_INVESTIGATOR access to researcher@example.com",
        ipAddress: "203.0.113.10",
      },
      {
        actorId: admin.id,
        actorEmail: "admin@example.com",
        actorRole: "ADMIN",
        action: "education.published",
        resourceType: "education-content",
        description: 'Published article "Understanding blood glucose readings"',
        ipAddress: "203.0.113.24",
      },
    ],
  });

  console.log("  ✓ audit history");

  console.log("\nSeed complete.\n");
  console.log("  Sign in at /admin/login with any of:");
  console.log("    super.admin@example.com   (Super administrator)");
  console.log("    admin@example.com         (Administrator)");
  console.log("    researcher@example.com    (Researcher — study DM01 only)");
  console.log("    reviewer@example.com      (Clinical reviewer)");
  console.log(`  Password for every seeded account: ${DEFAULT_PASSWORD}`);
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

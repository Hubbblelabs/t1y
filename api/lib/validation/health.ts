import { z } from "zod";

import {
  dateRangeSchema,
  idSchema,
  measuredAtSchema,
  notesSchema,
  paginationSchema,
  shortTextSchema,
  sortOrderSchema,
  timeOfDaySchema,
  timezoneSchema,
} from "@/lib/validation/common";

/**
 * Health-domain input schemas.
 *
 * The numeric bounds below are **data-entry plausibility limits**, not clinical
 * thresholds. They exist to reject typos and corrupt payloads (a glucose value
 * of 15000, a negative dose). Anything clinically meaningful — target ranges,
 * "high"/"low" classification — lives in the configurable `ClinicalThreshold`
 * table and is never hard-coded here.
 */

// ---------------------------------------------------------------------------
// Glucose
// ---------------------------------------------------------------------------

export const glucoseUnitSchema = z.enum(["MG_DL", "MMOL_L"]);
export const glucoseContextSchema = z.enum([
  "FASTING",
  "PRE_MEAL",
  "POST_MEAL",
  "BEDTIME",
  "OVERNIGHT",
  "PRE_EXERCISE",
  "POST_EXERCISE",
  "RANDOM",
]);
export const dataSourceSchema = z.enum(["MANUAL", "DEVICE", "IMPORT", "CLINICIAN"]);

/** Physiologically possible measurement range for each unit. */
const GLUCOSE_BOUNDS = {
  MG_DL: { min: 10, max: 1000 },
  MMOL_L: { min: 0.5, max: 55 },
} as const;

export const createGlucoseSchema = z
  .object({
    value: z.number().finite().positive(),
    unit: glucoseUnitSchema.default("MG_DL"),
    context: glucoseContextSchema.default("RANDOM"),
    measuredAt: measuredAtSchema,
    source: dataSourceSchema.default("MANUAL"),
    deviceId: z.string().trim().max(120).optional(),
    notes: notesSchema,
  })
  .superRefine((value, ctx) => {
    const bounds = GLUCOSE_BOUNDS[value.unit];
    if (value.value < bounds.min || value.value > bounds.max) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `A reading in ${value.unit === "MG_DL" ? "mg/dL" : "mmol/L"} must be between ${bounds.min} and ${bounds.max}.`,
      });
    }
  });

export const updateGlucoseSchema = z.object({
  value: z.number().finite().positive().optional(),
  unit: glucoseUnitSchema.optional(),
  context: glucoseContextSchema.optional(),
  measuredAt: measuredAtSchema.optional(),
  notes: notesSchema,
});

export const glucoseQuerySchema = z
  .object({
    context: glucoseContextSchema.optional(),
    unit: glucoseUnitSchema.optional(),
    sortOrder: sortOrderSchema,
  })
  .and(paginationSchema)
  .and(dateRangeSchema);

export const glucoseTrendQuerySchema = z
  .object({
    /** Aggregation bucket for the trend series. */
    interval: z.enum(["hour", "day", "week", "month"]).default("day"),
    context: glucoseContextSchema.optional(),
    unit: glucoseUnitSchema.default("MG_DL"),
  })
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

export const medicationFormSchema = z.enum([
  "TABLET",
  "CAPSULE",
  "LIQUID",
  "INJECTION",
  "PATCH",
  "INHALER",
  "OTHER",
]);

export const createMedicationSchema = z
  .object({
    name: shortTextSchema(120),
    genericName: z.string().trim().max(120).optional(),
    dosageText: shortTextSchema(80),
    form: medicationFormSchema.default("TABLET"),
    route: z.string().trim().max(60).optional(),
    frequency: shortTextSchema(80),
    timesPerDay: z.number().int().min(1).max(12).default(1),
    scheduleTimes: z.array(timeOfDaySchema).max(12).default([]),
    instructions: z.string().trim().max(1000).optional(),
    prescribedBy: z.string().trim().max(120).optional(),
    reason: z.string().trim().max(200).optional(),
    startDate: measuredAtSchema,
    endDate: z.iso.datetime({ offset: true, local: true }).transform((v) => new Date(v)).optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (value) => !value.endDate || value.endDate >= value.startDate,
    { message: "The end date must not be before the start date.", path: ["endDate"] },
  )
  .refine(
    (value) =>
      value.scheduleTimes.length === 0 ||
      value.scheduleTimes.length === value.timesPerDay,
    {
      message: "Provide one scheduled time for each daily dose, or none at all.",
      path: ["scheduleTimes"],
    },
  );

export const updateMedicationSchema = z.object({
  name: shortTextSchema(120).optional(),
  genericName: z.string().trim().max(120).nullish(),
  dosageText: shortTextSchema(80).optional(),
  form: medicationFormSchema.optional(),
  route: z.string().trim().max(60).nullish(),
  frequency: shortTextSchema(80).optional(),
  timesPerDay: z.number().int().min(1).max(12).optional(),
  scheduleTimes: z.array(timeOfDaySchema).max(12).optional(),
  instructions: z.string().trim().max(1000).nullish(),
  prescribedBy: z.string().trim().max(120).nullish(),
  reason: z.string().trim().max(200).nullish(),
  endDate: z.iso.datetime({ offset: true, local: true }).transform((v) => new Date(v)).nullish(),
  isActive: z.boolean().optional(),
});

export const medicationLogStatusSchema = z.enum([
  "PENDING",
  "TAKEN",
  "MISSED",
  "SKIPPED",
]);

export const createMedicationLogSchema = z
  .object({
    medicationId: idSchema,
    status: medicationLogStatusSchema,
    scheduledFor: z.iso
      .datetime({ offset: true, local: true })
      .transform((v) => new Date(v))
      .optional(),
    takenAt: measuredAtSchema.optional(),
    doseAmount: z.number().finite().positive().max(10000).optional(),
    doseUnit: z.string().trim().max(20).optional(),
    notes: notesSchema,
  })
  .refine(
    (value) => value.status !== "TAKEN" || value.takenAt !== undefined,
    { message: "A dose marked as taken requires the time it was taken.", path: ["takenAt"] },
  );

export const medicationLogQuerySchema = z
  .object({
    medicationId: idSchema.optional(),
    status: medicationLogStatusSchema.optional(),
    sortOrder: sortOrderSchema,
  })
  .and(paginationSchema)
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Insulin — recorded administrations only
// ---------------------------------------------------------------------------

export const insulinTypeSchema = z.enum([
  "RAPID_ACTING",
  "SHORT_ACTING",
  "INTERMEDIATE_ACTING",
  "LONG_ACTING",
  "ULTRA_LONG_ACTING",
  "PREMIXED",
  "OTHER",
]);

export const injectionSiteSchema = z.enum([
  "ABDOMEN",
  "LEFT_ARM",
  "RIGHT_ARM",
  "LEFT_THIGH",
  "RIGHT_THIGH",
  "LEFT_BUTTOCK",
  "RIGHT_BUTTOCK",
  "OTHER",
]);

export const mealAssociationSchema = z.enum([
  "BEFORE_MEAL",
  "WITH_MEAL",
  "AFTER_MEAL",
  "BEDTIME",
  "CORRECTION",
  "NONE",
]);

export const createInsulinLogSchema = z.object({
  insulinName: shortTextSchema(120),
  insulinType: insulinTypeSchema,
  /** The dose the participant actually administered. Never computed by the platform. */
  doseUnits: z.number().finite().positive().max(300, "Dose exceeds the accepted range."),
  unit: z.string().trim().max(10).default("IU"),
  administeredAt: measuredAtSchema,
  injectionSite: injectionSiteSchema.optional(),
  mealAssociation: mealAssociationSchema.default("NONE"),
  mealId: idSchema.optional(),
  notes: notesSchema,
});

export const updateInsulinLogSchema = createInsulinLogSchema.partial();

export const insulinQuerySchema = z
  .object({
    insulinType: insulinTypeSchema.optional(),
    sortOrder: sortOrderSchema,
  })
  .and(paginationSchema)
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export const mealTypeSchema = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK", "OTHER"]);

export const mealItemSchema = z.object({
  name: shortTextSchema(160),
  quantity: z.number().finite().positive().max(10000).default(1),
  unit: z.string().trim().max(40).default("serving"),
  carbsGrams: z.number().finite().min(0).max(2000).optional(),
  calories: z.number().finite().min(0).max(20000).optional(),
  proteinGrams: z.number().finite().min(0).max(2000).optional(),
  fatGrams: z.number().finite().min(0).max(2000).optional(),
  fiberGrams: z.number().finite().min(0).max(500).optional(),
  referenceCode: z.string().trim().max(64).optional(),
});

export const createMealSchema = z.object({
  name: z.string().trim().max(160).optional(),
  mealType: mealTypeSchema,
  consumedAt: measuredAtSchema,
  /**
   * Totals may be supplied directly, or derived from `items`. When both are
   * absent the meal is still a valid record — participants often log that they
   * ate without counting carbohydrates.
   */
  totalCarbsGrams: z.number().finite().min(0).max(2000).optional(),
  totalCalories: z.number().finite().min(0).max(20000).optional(),
  totalProteinGrams: z.number().finite().min(0).max(2000).optional(),
  totalFatGrams: z.number().finite().min(0).max(2000).optional(),
  totalFiberGrams: z.number().finite().min(0).max(500).optional(),
  /** Name of the validated nutrition database the values came from, if any. */
  nutritionSource: z.string().trim().max(120).optional(),
  photoUrl: z.url().max(2000).optional(),
  notes: notesSchema,
  items: z.array(mealItemSchema).max(50).default([]),
});

export const updateMealSchema = createMealSchema.partial();

export const mealQuerySchema = z
  .object({
    mealType: mealTypeSchema.optional(),
    sortOrder: sortOrderSchema,
  })
  .and(paginationSchema)
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

export const exerciseCategorySchema = z.enum([
  "AEROBIC",
  "STRENGTH",
  "FLEXIBILITY",
  "BALANCE",
  "BREATHING",
  "WALKING",
  "YOGA",
  "OTHER",
]);

export const exerciseIntensitySchema = z.enum(["LIGHT", "MODERATE", "VIGOROUS"]);

export const createExerciseLogSchema = z.object({
  exerciseId: idSchema.optional(),
  programId: idSchema.optional(),
  activityName: shortTextSchema(120),
  category: exerciseCategorySchema.default("OTHER"),
  durationMinutes: z.number().int().min(1).max(1440),
  intensity: exerciseIntensitySchema.default("MODERATE"),
  caloriesBurned: z.number().finite().min(0).max(20000).optional(),
  distanceKm: z.number().finite().min(0).max(1000).optional(),
  steps: z.number().int().min(0).max(500000).optional(),
  performedAt: measuredAtSchema,
  notes: notesSchema,
});

export const updateExerciseLogSchema = createExerciseLogSchema.partial();

export const exerciseQuerySchema = z
  .object({
    category: exerciseCategorySchema.optional(),
    intensity: exerciseIntensitySchema.optional(),
    sortOrder: sortOrderSchema,
  })
  .and(paginationSchema)
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// HbA1c
// ---------------------------------------------------------------------------

export const hba1cSourceSchema = z.enum([
  "LABORATORY",
  "POINT_OF_CARE",
  "SELF_REPORTED",
]);

export const createHbA1cSchema = z.object({
  /** Assay range for HbA1c as a percentage (NGSP units). */
  valuePercent: z.number().finite().min(3).max(20),
  /** IFCC units, when the laboratory reported them. */
  valueMmolMol: z.number().finite().min(9).max(195).optional(),
  measuredAt: measuredAtSchema,
  source: hba1cSourceSchema.default("LABORATORY"),
  laboratoryName: z.string().trim().max(160).optional(),
  orderedBy: z.string().trim().max(120).optional(),
  notes: notesSchema,
});

export const updateHbA1cSchema = createHbA1cSchema.partial();

export const hba1cQuerySchema = z
  .object({ sortOrder: sortOrderSchema })
  .and(paginationSchema)
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Health metrics
// ---------------------------------------------------------------------------

export const createHealthMetricSchema = z
  .object({
    /** Either the definition id or its stable key. */
    definitionId: idSchema.optional(),
    definitionKey: z.string().trim().max(64).optional(),
    value: z.number().finite().optional(),
    secondaryValue: z.number().finite().optional(),
    textValue: z.string().trim().max(500).optional(),
    measuredAt: measuredAtSchema,
    source: dataSourceSchema.default("MANUAL"),
    notes: notesSchema,
  })
  .refine(
    (value) => value.definitionId !== undefined || value.definitionKey !== undefined,
    { message: "Specify the metric by id or key.", path: ["definitionKey"] },
  )
  .refine(
    (value) =>
      value.value !== undefined ||
      value.textValue !== undefined,
    { message: "A measurement value is required.", path: ["value"] },
  );

export const updateHealthMetricSchema = z.object({
  value: z.number().finite().optional(),
  secondaryValue: z.number().finite().nullish(),
  textValue: z.string().trim().max(500).nullish(),
  measuredAt: measuredAtSchema.optional(),
  notes: notesSchema,
});

export const healthMetricQuerySchema = z
  .object({
    definitionKey: z.string().trim().max(64).optional(),
    definitionId: idSchema.optional(),
    sortOrder: sortOrderSchema,
  })
  .and(paginationSchema)
  .and(dateRangeSchema);

// ---------------------------------------------------------------------------
// Reminders and devices
// ---------------------------------------------------------------------------

export const notificationTypeSchema = z.enum([
  "MEDICATION_REMINDER",
  "GLUCOSE_REMINDER",
  "EXERCISE_REMINDER",
  "HBA1C_REMINDER",
  "EDUCATION",
  "GENERAL",
]);

export const reminderRecurrenceSchema = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);

export const createReminderSchema = z
  .object({
    type: notificationTypeSchema,
    title: shortTextSchema(120),
    body: z.string().trim().max(300).optional(),
    timeOfDay: timeOfDaySchema.optional(),
    recurrence: reminderRecurrenceSchema.default("DAILY"),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    timezone: timezoneSchema.default("UTC"),
    startsAt: z.iso.datetime({ offset: true, local: true }).transform((v) => new Date(v)).optional(),
    endsAt: z.iso.datetime({ offset: true, local: true }).transform((v) => new Date(v)).optional(),
    enabled: z.boolean().default(true),
    medicationId: idSchema.optional(),
  })
  .refine(
    (value) => value.recurrence !== "WEEKLY" || value.daysOfWeek.length > 0,
    { message: "Select at least one day for a weekly reminder.", path: ["daysOfWeek"] },
  )
  .refine(
    (value) => value.recurrence === "NONE" || value.timeOfDay !== undefined,
    { message: "A recurring reminder needs a time of day.", path: ["timeOfDay"] },
  )
  .refine(
    (value) => value.recurrence !== "MONTHLY" || value.dayOfMonth !== undefined,
    { message: "A monthly reminder needs a day of the month.", path: ["dayOfMonth"] },
  );

export const updateReminderSchema = z.object({
  title: shortTextSchema(120).optional(),
  body: z.string().trim().max(300).nullish(),
  timeOfDay: timeOfDaySchema.optional(),
  recurrence: reminderRecurrenceSchema.optional(),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullish(),
  timezone: timezoneSchema.optional(),
  enabled: z.boolean().optional(),
});

export const registerDeviceSchema = z.object({
  token: z.string().trim().min(10).max(512),
  platform: z.enum(["IOS", "ANDROID", "WEB"]),
  appVersion: z.string().trim().max(32).optional(),
});

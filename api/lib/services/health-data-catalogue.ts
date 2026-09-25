import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ageInYears } from "@/lib/services/profile-field-rules";

/**
 * What a calculator is allowed to know about a child.
 *
 * A calculator's inputs come from one of two places: the parent types the
 * number, or it is filled in from something already on file. This module is
 * the complete, closed list of the second kind — nothing can be read into a
 * formula that is not described here.
 *
 * ## What is deliberately excluded
 *
 * Engagement is not health data. How many topics a child has read, how many
 * quizzes they have taken, badges, streaks — none of it appears here and none
 * of it can reach a formula. That data exists to encourage the child and is
 * shown back to them as progress and rewards; it says nothing about their
 * body. A calculator that let a reading streak influence an insulin dose
 * would be clinically meaningless, and these two features are kept
 * deliberately separate for that reason.
 *
 * Contact details, names and addresses are excluded for the same reason:
 * this list is strictly the clinical picture.
 *
 * ## Freshness
 *
 * Every value drawn from a record carries the moment it was recorded, and
 * the app shows that beside the filled-in number so a parent can see they
 * are about to calculate from a reading taken three days ago. They can
 * always type over it. There is no hard cut-off — a stale number that is
 * visible and editable is safer than a blank the parent has to guess at.
 */

export type CatalogueSource = "GLUCOSE" | "INSULIN" | "PROFILE";

/**
 * Standard conversion between the two ways blood glucose is written down.
 * India uses mg/dL, which is what the curriculum's formulas (the 1800 and
 * 1500 rules) are expressed in.
 */
const MMOL_TO_MG_DL = 18.0182;

/**
 * Normalises a reading to mg/dL.
 *
 * Readings carry their own unit, and a formula has no way to ask which one
 * it was given — so an mmol/L reading handed straight to a correction-dose
 * formula would be wrong by a factor of eighteen. Converting here, once, at
 * the only point where stored readings enter a calculation, is what makes
 * that impossible.
 */
function toMgDl(value: number, unit: "MG_DL" | "MMOL_L"): number {
  return unit === "MMOL_L" ? value * MMOL_TO_MG_DL : value;
}

export interface CatalogueVariable {
  /** The name a formula uses. Stable; what a calculator input stores. */
  key: string;
  labelEn: string;
  labelTa?: string | null;
  unit: string | null;
  source: CatalogueSource;
  /** Plain-language note for the admin choosing it. */
  descriptionEn: string;
  /** False when nothing has ever been recorded for this across the study. */
  hasData: boolean;
  /** How many records back this value exists, for the admin's confidence. */
  recordCount: number;
}

/**
 * The fixed part of the catalogue: values derived from the health records
 * families enter directly. Keys are namespaced so a profile field can never
 * collide with one of these.
 */
const RECORD_VARIABLES: Array<
  Omit<CatalogueVariable, "hasData" | "recordCount"> & { counter: () => Promise<number> }
> = [
  {
    key: "glucose_latest",
    labelEn: "Most recent glucose reading",
    labelTa: "சமீபத்திய குளுக்கோஸ் அளவு",
    unit: "mg/dL",
    source: "GLUCOSE",
    descriptionEn: "The last blood glucose reading the family recorded, with the time it was taken.",
    counter: () => prisma.glucoseReading.count(),
  },
  {
    key: "glucose_average_today",
    labelEn: "Average glucose today",
    labelTa: "இன்றைய சராசரி குளுக்கோஸ்",
    unit: "mg/dL",
    source: "GLUCOSE",
    descriptionEn: "The average of every glucose reading recorded so far today.",
    counter: () => prisma.glucoseReading.count(),
  },
  {
    key: "insulin_total_today",
    labelEn: "Insulin taken today",
    labelTa: "இன்று எடுத்த இன்சுலின்",
    unit: "units",
    source: "INSULIN",
    descriptionEn: "Every insulin dose recorded today, added up.",
    counter: () => prisma.insulinLog.count(),
  },
  {
    key: "insulin_total_daily_dose",
    labelEn: "Usual total daily insulin dose",
    labelTa: "வழக்கமான மொத்த தினசரி இன்சுலின் அளவு",
    unit: "units",
    source: "INSULIN",
    descriptionEn:
      "The average of the last seven full days of recorded insulin — what the 500, 1800 and " +
      "1500 rules are based on.",
    counter: () => prisma.insulinLog.count(),
  },
];

/** The one calculator value that is worked out rather than stored. */
const AGE_KEY = "profile_age";

/** The built-in date of birth, the only date a calculator can use. */
function isBirthDate(field: { key: string; fieldType: string; builtIn: boolean }): boolean {
  return field.builtIn && field.key === "dateOfBirth" && field.fieldType === "DATE";
}

/**
 * A child's age, offered once the date of birth is marked as medical.
 *
 * Age is not stored anywhere — it is a fact about a date and today — so a
 * dose formula that wants it would otherwise have to be given a date it
 * cannot do arithmetic on. Whole completed years, the way an age is
 * normally quoted.
 */
function ageVariable(): CatalogueVariable {
  return {
    key: AGE_KEY,
    labelEn: "Age of the child",
    labelTa: "குழந்தையின் வயது",
    unit: "years",
    source: "PROFILE",
    descriptionEn: "Worked out from the date of birth on the profile.",
    hasData: true,
    recordCount: 0,
  };
}

/**
 * Every value a calculator could draw on, including ones nothing has been
 * recorded for yet.
 *
 * Empty ones are listed rather than hidden, marked `hasData: false`. An
 * admin needs to see that "insulin taken today" exists but has nothing
 * behind it yet — silently omitting it would just look like the feature is
 * missing, and they would have no way to know a calculator built on it would
 * have nothing to fill in.
 */
export async function listCatalogueVariables(): Promise<CatalogueVariable[]> {
  const records = await Promise.all(
    RECORD_VARIABLES.map(async ({ counter, ...variable }) => {
      const recordCount = await counter();
      return { ...variable, hasData: recordCount > 0, recordCount };
    }),
  );

  const medicalFields = await prisma.profileFieldDefinition.findMany({
    where: { active: true, isMedical: true },
    orderBy: { sortOrder: "asc" },
    select: {
      key: true,
      labelEn: true,
      labelTa: true,
      unit: true,
      fieldType: true,
      options: true,
      builtIn: true,
    },
  });

  const profileVariables: CatalogueVariable[] = medicalFields
    // TEXT and DATE cannot take part in arithmetic. A CHOICE field can, but
    // only once every option says which number it stands for — otherwise a
    // formula would be doing sums on a word. (The one exception is the date
    // of birth, offered as an age; see AGE_KEY.)
    .filter(
      (field) =>
        field.fieldType === "NUMBER" ||
        isNumericChoice(field.options) ||
        isBirthDate(field),
    )
    .map((field) => (isBirthDate(field) ? ageVariable() : {
      key: `profile_${field.key}`,
      labelEn: field.labelEn,
      labelTa: field.labelTa,
      unit: field.unit,
      source: "PROFILE" as const,
      descriptionEn:
        field.fieldType === "NUMBER"
          ? "A medical detail recorded on the child's profile."
          : "A medical choice on the child's profile, counted as the number set for each option.",
      hasData: true,
      recordCount: 0,
    }));

  return [...records, ...profileVariables];
}

/** True when every option of a CHOICE field carries a usable number. */
function isNumericChoice(options: unknown): boolean {
  if (!Array.isArray(options) || options.length === 0) return false;
  return options.every(
    (option) =>
      option != null &&
      typeof option === "object" &&
      typeof (option as { numericValue?: unknown }).numericValue === "number",
  );
}

export interface ResolvedValue {
  key: string;
  value: number | null;
  /** When the underlying record was made. Null for profile details. */
  recordedAt: Date | null;
  /** Why there is no value, for the app to show in place of one. */
  missingReason?: string;
}

/**
 * Fills in the catalogue values for one child.
 *
 * Used to pre-fill a calculator's inputs, both on the phone (always for the
 * caller's own current moment) and from the admin's calculator workbench,
 * where a coordinator may ask for a value "as of" an earlier point instead —
 * working out what a calculator would have shown a child last Tuesday. A
 * value that cannot be resolved comes back null with a reason rather than as
 * a zero — a missing reading must never be silently treated as a glucose
 * of 0.
 */
export async function resolveCatalogueValues(
  userId: string,
  keys: readonly string[],
  asOf: Date = new Date(),
): Promise<ResolvedValue[]> {
  const wanted = new Set(keys);
  const resolved: ResolvedValue[] = [];

  const startOfToday = new Date(asOf);
  startOfToday.setHours(0, 0, 0, 0);

  if (wanted.has("glucose_latest")) {
    const latest = await prisma.glucoseReading.findFirst({
      where: { userId, measuredAt: { lte: asOf } },
      orderBy: { measuredAt: "desc" },
      select: { value: true, unit: true, measuredAt: true },
    });
    resolved.push({
      key: "glucose_latest",
      value: latest ? toMgDl(latest.value, latest.unit) : null,
      recordedAt: latest?.measuredAt ?? null,
      ...(latest ? {} : { missingReason: "No glucose reading has been recorded yet." }),
    });
  }

  if (wanted.has("glucose_average_today")) {
    // Averaged in code rather than by the database, because readings can be
    // stored in either unit and each one has to be converted before it can
    // be added to the others. A day's readings are a handful of rows.
    const today = await prisma.glucoseReading.findMany({
      where: { userId, measuredAt: { gte: startOfToday, lte: asOf } },
      select: { value: true, unit: true, measuredAt: true },
    });

    const total = today.reduce((sum, reading) => sum + toMgDl(reading.value, reading.unit), 0);
    const mostRecent = today.reduce<Date | null>(
      (latest, reading) => (latest === null || reading.measuredAt > latest ? reading.measuredAt : latest),
      null,
    );

    resolved.push({
      key: "glucose_average_today",
      value: today.length > 0 ? total / today.length : null,
      recordedAt: mostRecent,
      ...(today.length > 0 ? {} : { missingReason: "No glucose reading recorded today." }),
    });
  }

  if (wanted.has("insulin_total_today")) {
    const today = await prisma.insulinLog.aggregate({
      where: { userId, administeredAt: { gte: startOfToday, lte: asOf } },
      _sum: { doseUnits: true },
      _max: { administeredAt: true },
      _count: true,
    });
    resolved.push({
      key: "insulin_total_today",
      value: today._count > 0 ? (today._sum.doseUnits ?? null) : null,
      recordedAt: today._max.administeredAt ?? null,
      ...(today._count > 0 ? {} : { missingReason: "No insulin recorded today." }),
    });
  }

  if (wanted.has("insulin_total_daily_dose")) {
    resolved.push(await resolveUsualDailyDose(userId, startOfToday));
  }

  const profileKeys = [...wanted].filter((key) => key.startsWith("profile_"));
  if (profileKeys.length > 0) {
    resolved.push(...(await resolveProfileValues(userId, profileKeys)));
  }

  return resolved;
}

/**
 * The child's usual total daily insulin, averaged over the last seven
 * *complete* days.
 *
 * Today is excluded on purpose: a day still in progress would drag the
 * average down and make every ratio derived from it too generous. Days with
 * nothing recorded are skipped rather than counted as zero, for the same
 * reason — a family who forgot to log on Sunday did not take no insulin.
 */
async function resolveUsualDailyDose(userId: string, startOfToday: Date): Promise<ResolvedValue> {
  const weekStart = new Date(startOfToday);
  weekStart.setDate(weekStart.getDate() - 7);

  const logs = await prisma.insulinLog.findMany({
    where: { userId, administeredAt: { gte: weekStart, lt: startOfToday } },
    select: { doseUnits: true, administeredAt: true },
  });

  if (logs.length === 0) {
    return {
      key: "insulin_total_daily_dose",
      value: null,
      recordedAt: null,
      missingReason: "No insulin recorded in the last seven days.",
    };
  }

  const byDay = new Map<string, number>();
  let mostRecent = logs[0].administeredAt;
  for (const log of logs) {
    const day = log.administeredAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + log.doseUnits);
    if (log.administeredAt > mostRecent) mostRecent = log.administeredAt;
  }

  const total = [...byDay.values()].reduce((sum, units) => sum + units, 0);
  return {
    key: "insulin_total_daily_dose",
    value: total / byDay.size,
    recordedAt: mostRecent,
  };
}

async function resolveProfileValues(
  userId: string,
  profileKeys: string[],
): Promise<ResolvedValue[]> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      customFieldValues: true,
      dateOfBirth: true,
      heightCm: true,
      baselineWeightKg: true,
      diagnosisYear: true,
      sex: true,
      treatmentModality: true,
    },
  });

  const customAnswers = (profile?.customFieldValues ?? {}) as Record<string, unknown>;

  // Built-in questions keep their answers in real columns, not in the custom
  // bucket, so they are read from there.
  const columnAnswers: Record<string, unknown> = {
    heightCm: profile?.heightCm,
    baselineWeightKg: profile?.baselineWeightKg,
    diagnosisYear: profile?.diagnosisYear,
    sex: profile?.sex,
    treatmentModality: profile?.treatmentModality,
  };

  const definitions = await prisma.profileFieldDefinition.findMany({
    where: { key: { in: profileKeys.map((key) => key.slice("profile_".length)) } },
    select: { key: true, fieldType: true, options: true, builtIn: true },
  });
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));

  return profileKeys.map((prefixed): ResolvedValue => {
    if (prefixed === AGE_KEY) {
      const born = profile?.dateOfBirth;
      return born
        ? { key: prefixed, value: ageInYears(born), recordedAt: null }
        : {
            key: prefixed,
            value: null,
            recordedAt: null,
            missingReason: "The date of birth has not been filled in on the profile yet.",
          };
    }

    const fieldKey = prefixed.slice("profile_".length);
    const definition = byKey.get(fieldKey);
    const answer = definition?.builtIn ? columnAnswers[fieldKey] : customAnswers[fieldKey];

    if (definition == null || answer == null || answer === "") {
      return {
        key: prefixed,
        value: null,
        recordedAt: null,
        missingReason: "This has not been filled in on the profile yet.",
      };
    }

    if (definition.fieldType === "NUMBER") {
      const value = typeof answer === "number" ? answer : Number(answer);
      return Number.isFinite(value)
        ? { key: prefixed, value, recordedAt: null }
        : {
            key: prefixed,
            value: null,
            recordedAt: null,
            missingReason: "The value on the profile is not a number.",
          };
    }

    // A CHOICE field contributes the number its selected option stands for.
    const options = Array.isArray(definition.options) ? definition.options : [];
    const selected = options.find(
      (option) =>
        option != null &&
        typeof option === "object" &&
        (option as { value?: unknown }).value === answer,
    ) as { numericValue?: unknown } | undefined;

    return typeof selected?.numericValue === "number"
      ? { key: prefixed, value: selected.numericValue, recordedAt: null }
      : {
          key: prefixed,
          value: null,
          recordedAt: null,
          missingReason: "This choice has no number set for it.",
        };
  });
}

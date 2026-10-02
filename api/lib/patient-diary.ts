/**
 * Pure helpers for the patient-diary Excel export (lib/services/patient-diary-export.ts):
 * the figures the paper diary derives (age, BMI) and how readings are placed
 * into the diary's day-by-day columns.
 */

/** The diary's six sugar columns, in the order the paper diary lists them. */
export const DIARY_SLOT_COLUMNS = [
  { slot: "PRE_BREAKFAST", header: "Before breakfast (mg/dL)" },
  { slot: "POST_BREAKFAST", header: "2 h after breakfast (mg/dL)" },
  { slot: "PRE_LUNCH", header: "Before lunch (mg/dL)" },
  { slot: "POST_LUNCH", header: "2 h after lunch (mg/dL)" },
  { slot: "PRE_DINNER", header: "Before dinner (mg/dL)" },
  { slot: "POST_DINNER", header: "2 h after dinner (mg/dL)" },
] as const;

export type DiarySlot = (typeof DIARY_SLOT_COLUMNS)[number]["slot"];

const MMOL_TO_MGDL = 18.0182;

export function toMgDl(value: number, unit: "MG_DL" | "MMOL_L"): number {
  return unit === "MMOL_L" ? value * MMOL_TO_MGDL : value;
}

/** Whole years between `dob` and `on`; null if there is no date of birth. */
export function ageInYears(dob: Date | null | undefined, on: Date = new Date()): number | null {
  if (!dob) return null;
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/** kg ÷ m², one decimal; null unless both numbers are usable. */
export function bmi(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day (YYYY-MM-DD) a moment falls on in the child's timezone. */
export function dayKey(at: Date, timeZone: string): string {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    }
    formatters.set(timeZone, fmt);
  }
  return fmt.format(at);
}

/**
 * Which diary column a glucose reading belongs in. A reading tagged with a slot
 * goes there; an older one tagged only as FASTING counts as "before breakfast";
 * anything else cannot be placed in the diary's columns and is left out.
 */
export function diarySlotFor(reading: { slot: string | null; context: string }): DiarySlot | null {
  if (reading.slot) return reading.slot as DiarySlot;
  if (reading.context === "FASTING") return "PRE_BREAKFAST";
  return null;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

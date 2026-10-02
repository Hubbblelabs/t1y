/**
 * What health data a participant is asked to record — the client-safe
 * registry shared by the server (which validates and enforces it) and the
 * admin dashboard's forms (which only need the keys and labels).
 *
 * Stored on `Profile` (glucoseSlots, insulinIntervalHours, exerciseEnabled,
 * exerciseReminderHours) and read by the phone from `/api/users/me`.
 */
export const GLUCOSE_SLOT_KEYS = [
  "PRE_BREAKFAST",
  "POST_BREAKFAST",
  "PRE_LUNCH",
  "POST_LUNCH",
  "PRE_DINNER",
  "POST_DINNER",
] as const;

export type GlucoseSlotKey = (typeof GLUCOSE_SLOT_KEYS)[number];

export const GLUCOSE_SLOT_LABELS: Record<GlucoseSlotKey, string> = {
  PRE_BREAKFAST: "Pre-breakfast",
  POST_BREAKFAST: "Post-breakfast",
  PRE_LUNCH: "Pre-lunch",
  POST_LUNCH: "Post-lunch",
  PRE_DINNER: "Pre-dinner",
  POST_DINNER: "Post-dinner",
};

/** Whether a slot is before or after the meal — the matching `GlucoseContext`. */
export function glucoseContextForSlot(slot: GlucoseSlotKey): "PRE_MEAL" | "POST_MEAL" {
  return slot.startsWith("PRE_") ? "PRE_MEAL" : "POST_MEAL";
}

/** What a parent can ask a guardian to record through a link. */
export const GUARDIAN_COLLECT_KEYS = ["GLUCOSE", "INSULIN", "CARBS", "EXERCISE"] as const;
export type GuardianCollectKey = (typeof GUARDIAN_COLLECT_KEYS)[number];

/** Longest reminder gap an admin may set: once a day. */
export const MAX_REMINDER_HOURS = 24;

export interface HealthDataConfig {
  glucoseSlots: GlucoseSlotKey[];
  /** 24 = once a day, 12 = twice a day, 4 = every four hours. null = no insulin reminder. */
  insulinIntervalHours: number | null;
  exerciseEnabled: boolean;
  exerciseReminderHours: number | null;
}

export const DEFAULT_HEALTH_CONFIG: HealthDataConfig = {
  glucoseSlots: [...GLUCOSE_SLOT_KEYS],
  insulinIntervalHours: null,
  exerciseEnabled: false,
  exerciseReminderHours: null,
};

/** A one-line description for the review step and the participant card. */
export function describeHealthConfig(config: HealthDataConfig): string[] {
  return [
    config.glucoseSlots.length
      ? `Glucose: ${GLUCOSE_SLOT_KEYS.filter((k) => config.glucoseSlots.includes(k))
          .map((k) => GLUCOSE_SLOT_LABELS[k])
          .join(", ")}`
      : "Glucose: none",
    config.insulinIntervalHours
      ? `Insulin: every ${config.insulinIntervalHours} hour${config.insulinIntervalHours === 1 ? "" : "s"}`
      : "Insulin: no reminder",
    config.exerciseEnabled
      ? config.exerciseReminderHours
        ? `Exercise: on, reminder every ${config.exerciseReminderHours} hour${config.exerciseReminderHours === 1 ? "" : "s"}`
        : "Exercise: on, no reminder"
      : "Exercise: off",
  ];
}

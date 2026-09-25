import { z } from "zod";

/**
 * The checks a profile question's answer must pass.
 *
 * Each question type carries the rules that make sense for it, and only
 * those — a text question has a length and a character set, a number has a
 * range, a date has limits on how far back or forward it may fall. They are
 * kept as one small closed set rather than free-form patterns: the people
 * configuring these are study coordinators, and "letters only, 2 to 80
 * characters" is something they can read back and be sure of, where a
 * regular expression is not.
 *
 * This module does two jobs so the two can never disagree: it *checks* an
 * answer against the rules, and it *describes* the same rules in plain words
 * for the dashboard. Both walk the same rule set.
 */

export type ProfileFieldType = "TEXT" | "NUMBER" | "DATE" | "CHOICE";

export interface TextRules {
  minLength?: number | null;
  maxLength?: number | null;
  /** LETTERS allows letters (English and Tamil), spaces, hyphens, apostrophes. */
  format?: "ANY" | "LETTERS" | null;
}

export interface NumberRules {
  min?: number | null;
  max?: number | null;
  wholeNumber?: boolean | null;
  /** The upper limit is this year, whenever "this" is — for year answers. */
  upToCurrentYear?: boolean | null;
  /**
   * Key of a date question; this answer, read as a year, may not be earlier
   * than that date's year (a diagnosis cannot precede the birth).
   */
  notBeforeYearOf?: string | null;
}

export interface DateRules {
  notInFuture?: boolean | null;
  /** Oldest and youngest the answer may make the person, in whole years. */
  minAgeYears?: number | null;
  maxAgeYears?: number | null;
}

export type ProfileFieldRules = TextRules & NumberRules & DateRules;

const count = z.number().int().min(0).max(10_000).nullish();
const anyNumber = z.number().finite().nullish();

/** What may be stored, per type. Unknown keys are rejected, not ignored. */
const RULE_SCHEMAS = {
  TEXT: z
    .object({
      minLength: count,
      maxLength: z.number().int().min(1).max(10_000).nullish(),
      format: z.enum(["ANY", "LETTERS"]).nullish(),
    })
    .strict(),
  NUMBER: z
    .object({
      min: anyNumber,
      max: anyNumber,
      wholeNumber: z.boolean().nullish(),
      upToCurrentYear: z.boolean().nullish(),
      notBeforeYearOf: z.string().trim().min(1).max(60).nullish(),
    })
    .strict(),
  DATE: z
    .object({
      notInFuture: z.boolean().nullish(),
      minAgeYears: count,
      maxAgeYears: count,
    })
    .strict(),
  CHOICE: z.object({}).strict(),
} as const;

/**
 * Cleans and checks the rules an admin submitted for a question of `type`.
 * Returns the tidy version, or the message to show them.
 */
export function parseRules(
  type: ProfileFieldType,
  raw: unknown,
): { ok: true; rules: ProfileFieldRules | null } | { ok: false; message: string } {
  if (raw == null) return { ok: true, rules: null };

  const parsed = RULE_SCHEMAS[type].safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Those checks do not suit this kind of question." };
  }

  const rules = parsed.data as ProfileFieldRules;

  if (rules.minLength != null && rules.maxLength != null && rules.minLength > rules.maxLength) {
    return { ok: false, message: "The shortest allowed cannot be longer than the longest." };
  }
  if (rules.min != null && rules.max != null && rules.min > rules.max) {
    return { ok: false, message: "The lowest allowed cannot be more than the highest." };
  }
  if (
    rules.minAgeYears != null &&
    rules.maxAgeYears != null &&
    rules.minAgeYears > rules.maxAgeYears
  ) {
    return { ok: false, message: "The youngest allowed cannot be older than the oldest." };
  }

  // Store nothing rather than an object of empties.
  const meaningful = Object.values(rules).some((value) => value != null && value !== false);
  return { ok: true, rules: meaningful ? rules : null };
}

// ---------------------------------------------------------------------------
// Describing
// ---------------------------------------------------------------------------

/** Says the rules the way a person would read them off a form. */
export function describeRules(
  type: ProfileFieldType,
  rules: ProfileFieldRules | null | undefined,
  options?: { unit?: string | null; labelOf?: (key: string) => string },
): string[] {
  if (!rules) return type === "CHOICE" ? ["One of the listed options"] : [];
  const lines: string[] = [];

  if (type === "TEXT") {
    if (rules.minLength != null && rules.maxLength != null) {
      lines.push(`${rules.minLength} to ${rules.maxLength} characters`);
    } else if (rules.maxLength != null) {
      lines.push(`Up to ${rules.maxLength} characters`);
    } else if (rules.minLength != null) {
      lines.push(`At least ${rules.minLength} characters`);
    }
    if (rules.format === "LETTERS") {
      lines.push("Letters only (English or Tamil), with spaces, hyphens and apostrophes");
    }
  }

  if (type === "NUMBER") {
    const unit = options?.unit ? ` ${options.unit}` : "";
    if (rules.wholeNumber) lines.push("A whole number");
    if (rules.min != null && rules.max != null) {
      lines.push(`Between ${rules.min} and ${rules.max}${unit}`);
    } else if (rules.min != null) {
      lines.push(`At least ${rules.min}${unit}`);
    } else if (rules.max != null) {
      lines.push(`No more than ${rules.max}${unit}`);
    }
    if (rules.upToCurrentYear) lines.push("Not later than this year");
    if (rules.notBeforeYearOf) {
      const name = options?.labelOf?.(rules.notBeforeYearOf) ?? rules.notBeforeYearOf;
      lines.push(`Not earlier than the year of "${name}"`);
    }
  }

  if (type === "DATE") {
    if (rules.notInFuture) lines.push("Cannot be in the future");
    if (rules.minAgeYears != null && rules.maxAgeYears != null) {
      lines.push(`Makes the child between ${rules.minAgeYears} and ${rules.maxAgeYears} years old`);
    } else if (rules.maxAgeYears != null) {
      lines.push(`No more than ${rules.maxAgeYears} years ago`);
    } else if (rules.minAgeYears != null) {
      lines.push(`At least ${rules.minAgeYears} years ago`);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

const LETTERS_ONLY = /^[A-Za-z஀-௿\s\-']+$/;

/** Whole years between a birth date and now. */
export function ageInYears(born: Date, now: Date = new Date()): number {
  let years = now.getFullYear() - born.getFullYear();
  const hadBirthday =
    now.getMonth() > born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate());
  if (!hadBirthday) years -= 1;
  return years;
}

/**
 * Checks one answer against its question's rules.
 *
 * Returns the message to show the parent, or null when it is fine. Written
 * for a parent to read and act on, and worded the same way whichever
 * question it is, so a family sees one consistent voice.
 *
 * `answers` carries the other answers on the same form, which is what lets
 * a year be checked against a date the parent gave earlier.
 */
export function checkAnswer(
  question: { labelEn: string; fieldType: ProfileFieldType; rules?: ProfileFieldRules | null },
  value: unknown,
  context?: { answers?: Record<string, unknown>; now?: Date },
): string | null {
  const { labelEn, fieldType } = question;
  const rules = question.rules ?? {};
  const now = context?.now ?? new Date();

  if (fieldType === "TEXT") {
    if (typeof value !== "string") return `"${labelEn}" must be text.`;
    const text = value.trim();
    if (rules.minLength != null && text.length < rules.minLength) {
      return `"${labelEn}" needs at least ${rules.minLength} characters.`;
    }
    if (rules.maxLength != null && text.length > rules.maxLength) {
      return `Please keep "${labelEn}" under ${rules.maxLength} characters.`;
    }
    if (rules.format === "LETTERS" && !LETTERS_ONLY.test(text)) {
      return `"${labelEn}" should use letters only.`;
    }
    return null;
  }

  if (fieldType === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `"${labelEn}" must be a number.`;
    }
    if (rules.wholeNumber && !Number.isInteger(value)) {
      return `"${labelEn}" must be a whole number.`;
    }
    if (rules.min != null && value < rules.min) {
      return `"${labelEn}" cannot be less than ${rules.min}.`;
    }
    if (rules.max != null && value > rules.max) {
      return `"${labelEn}" cannot be more than ${rules.max}.`;
    }
    if (rules.upToCurrentYear && value > now.getFullYear()) {
      return `"${labelEn}" cannot be later than ${now.getFullYear()}.`;
    }
    if (rules.notBeforeYearOf) {
      const other = context?.answers?.[rules.notBeforeYearOf];
      const otherYear = typeof other === "string" ? new Date(other).getFullYear() : NaN;
      if (Number.isFinite(otherYear) && value < otherYear) {
        return `"${labelEn}" cannot be earlier than ${otherYear}. Please check the year.`;
      }
    }
    return null;
  }

  if (fieldType === "DATE") {
    const date = typeof value === "string" ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return `"${labelEn}" must be a valid date.`;
    if (rules.notInFuture && date.getTime() > now.getTime()) {
      return `"${labelEn}" cannot be in the future.`;
    }
    const age = ageInYears(date, now);
    if (rules.minAgeYears != null && age < rules.minAgeYears) {
      return `"${labelEn}" is too recent. Please check the date.`;
    }
    if (rules.maxAgeYears != null && age > rules.maxAgeYears) {
      return `"${labelEn}" is too long ago. Please check the date.`;
    }
    return null;
  }

  // CHOICE is checked against its options by the caller.
  return null;
}

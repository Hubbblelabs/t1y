import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import {
  checkAnswer,
  parseRules,
  type ProfileFieldRules,
} from "@/lib/services/profile-field-rules";

/**
 * Admin-defined fields on the parent-facing profile form, on top of the
 * fixed set of columns [Profile] already has.
 *
 * Values a parent enters for these live in `Profile.customFieldValues`, a
 * JSON bucket keyed by [ProfileFieldDefinition.key] — see the schema's own
 * doc comment for why that's a bucket rather than a column per field.
 *
 * ## Built-in questions
 *
 * The questions the app has always asked (name, date of birth, phone…) are
 * registered here too, flagged `builtIn`, so the whole set can be seen and
 * described in one place. They are **not** part of what the app fetches or of
 * the save-time required check below: their answers live in real `Profile`
 * columns and the app still asks them from its own screens. Letting one into
 * either path would show it twice and make every save fail on a "missing"
 * custom answer that was never meant to exist.
 *
 * Deactivating a field is the only way to retire one (see
 * [updateProfileFieldDefinition]): there is no delete, because a hard
 * delete would either orphan already-collected answers or force cascading
 * them away, and this is self-reported study data.
 */

const FIELD_SELECT = {
  id: true,
  key: true,
  fieldType: true,
  section: true,
  required: true,
  active: true,
  sortOrder: true,
  labelEn: true,
  labelTa: true,
  hintEn: true,
  hintTa: true,
  options: true,
  isMedical: true,
  unit: true,
  builtIn: true,
  showOnSignup: true,
  promptEn: true,
  promptTa: true,
  rules: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProfileFieldDefinitionSelect;

export type ProfileFieldDefinition = Prisma.ProfileFieldDefinitionGetPayload<{
  select: typeof FIELD_SELECT;
}>;

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/**
 * The four questions sign-up cannot work without. They cannot be switched
 * off, made optional, or moved off the sign-up chat: the child's account is
 * created from them.
 */
export const CORE_BUILT_IN_KEYS = ["name", "dateOfBirth", "sex", "diagnosisYear"] as const;

export function isCoreBuiltIn(key: string): boolean {
  return (CORE_BUILT_IN_KEYS as readonly string[]).includes(key);
}

export interface ChoiceOption {
  value: string;
  labelEn: string;
  labelTa?: string;
  /** What this choice counts as in a calculator. See the validation schema. */
  numericValue?: number | null;
}

/** Admin view: every field, including inactive ones, oldest-defined first within each sort position. */
export async function listAllProfileFieldDefinitions(): Promise<ProfileFieldDefinition[]> {
  return prisma.profileFieldDefinition.findMany({
    select: FIELD_SELECT,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * App-facing view: only what a parent should currently be asked to fill in.
 *
 * Excludes built-in questions on purpose — see the note at the top of this
 * file. This one function is both what the app renders as extra fields and
 * what the save-time required check runs over, so a built-in here would be
 * drawn twice and fail every save.
 */
export async function listActiveProfileFieldDefinitions(): Promise<ProfileFieldDefinition[]> {
  return prisma.profileFieldDefinition.findMany({
    where: { active: true, builtIn: false },
    select: FIELD_SELECT,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export interface CreateProfileFieldInput {
  key: string;
  fieldType: "TEXT" | "NUMBER" | "DATE" | "CHOICE";
  section?: string;
  required?: boolean;
  active?: boolean;
  sortOrder?: number;
  labelEn: string;
  labelTa?: string | null;
  hintEn?: string | null;
  hintTa?: string | null;
  options?: ChoiceOption[] | null;
  isMedical?: boolean;
  unit?: string | null;
  /** Asked in the sign-up chat rather than left to the profile screen. */
  showOnSignup?: boolean;
  /** The sentence the sign-up chat asks, when `showOnSignup` is on. */
  promptEn?: string | null;
  promptTa?: string | null;
  /** Checks the answer must pass; shape depends on `fieldType`. */
  rules?: unknown;
}

/** Cleans submitted rules for a question type, or throws the message to show. */
function cleanRules(
  fieldType: "TEXT" | "NUMBER" | "DATE" | "CHOICE",
  raw: unknown,
): ProfileFieldRules | null {
  const result = parseRules(fieldType, raw);
  if (!result.ok) throw new ValidationError(result.message);
  return result.rules;
}

function assertValidOptions(fieldType: string, options: ChoiceOption[] | null | undefined): void {
  if (fieldType === "CHOICE") {
    if (!options || options.length === 0) {
      throw new ValidationError("A choice field needs at least one option.");
    }
    const values = new Set<string>();
    for (const option of options) {
      if (!option.value.trim() || !option.labelEn.trim()) {
        throw new ValidationError("Every option needs a value and an English label.");
      }
      if (values.has(option.value)) {
        throw new ValidationError(`Duplicate option value "${option.value}".`);
      }
      values.add(option.value);
    }
  } else if (options && options.length > 0) {
    throw new ValidationError("Options only apply to a choice field.");
  }
}

export async function createProfileFieldDefinition(
  input: CreateProfileFieldInput,
): Promise<ProfileFieldDefinition> {
  const key = input.key.trim();
  if (!KEY_PATTERN.test(key)) {
    throw new ValidationError(
      "Field key must start with a lowercase letter and contain only letters and digits (e.g. \"schoolName\").",
    );
  }
  if (!input.labelEn.trim()) {
    throw new ValidationError("An English label is required.");
  }
  assertValidOptions(input.fieldType, input.options);
  const rules = cleanRules(input.fieldType, input.rules);

  const clash = await prisma.profileFieldDefinition.findUnique({ where: { key } });
  if (clash) throw new ConflictError("A field with that key already exists.");

  return prisma.profileFieldDefinition.create({
    data: {
      key,
      fieldType: input.fieldType,
      section: input.section?.trim() || "Additional details",
      required: input.required ?? false,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      labelEn: input.labelEn.trim(),
      labelTa: input.labelTa?.trim() || null,
      hintEn: input.hintEn?.trim() || null,
      hintTa: input.hintTa?.trim() || null,
      options: (input.options ?? undefined) as Prisma.InputJsonValue | undefined,
      isMedical: input.isMedical ?? false,
      unit: input.unit?.trim() || null,
      showOnSignup: input.showOnSignup ?? false,
      promptEn: input.promptEn?.trim() || null,
      promptTa: input.promptTa?.trim() || null,
      rules: rules === null ? undefined : (rules as unknown as Prisma.InputJsonValue),
      // Only the seed script creates built-in questions; the dashboard's
      // "add a question" can never mint one.
      builtIn: false,
    },
    select: FIELD_SELECT,
  });
}

export interface UpdateProfileFieldInput {
  section?: string;
  required?: boolean;
  active?: boolean;
  sortOrder?: number;
  labelEn?: string;
  labelTa?: string | null;
  hintEn?: string | null;
  hintTa?: string | null;
  options?: ChoiceOption[] | null;
  isMedical?: boolean;
  unit?: string | null;
  showOnSignup?: boolean;
  promptEn?: string | null;
  promptTa?: string | null;
  rules?: unknown;
}

/**
 * Updates everything about a field except its `key` and `fieldType`, which
 * are load-bearing for data already collected under it — changing either
 * out from under existing answers would silently corrupt or orphan them.
 *
 * Deactivating a field (`active: false`) always forces `required: false` in
 * the same write, whether or not the caller asked for that: an inactive
 * field is never asked for, so "required and never asked" is a
 * contradiction, not a state this can leave behind. This is exactly the
 * backward-compatibility guarantee — retiring a field can never leave an
 * existing profile looking incomplete because of a question it will never
 * see again.
 */
export async function updateProfileFieldDefinition(
  id: string,
  input: UpdateProfileFieldInput,
): Promise<ProfileFieldDefinition> {
  const existing = await prisma.profileFieldDefinition.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Field");

  if (input.labelEn !== undefined && !input.labelEn.trim()) {
    throw new ValidationError("An English label is required.");
  }
  if (input.options !== undefined) {
    assertValidOptions(existing.fieldType, input.options);
  }

  if (existing.builtIn) assertBuiltInEditIsAllowed(existing, input);

  const rules = input.rules === undefined ? undefined : cleanRules(existing.fieldType, input.rules);

  const active = input.active ?? existing.active;
  const required = active ? (input.required ?? existing.required) : false;

  return prisma.profileFieldDefinition.update({
    where: { id },
    data: {
      section: input.section?.trim() || undefined,
      required,
      active,
      sortOrder: input.sortOrder,
      labelEn: input.labelEn?.trim(),
      labelTa: input.labelTa === undefined ? undefined : input.labelTa?.trim() || null,
      hintEn: input.hintEn === undefined ? undefined : input.hintEn?.trim() || null,
      hintTa: input.hintTa === undefined ? undefined : input.hintTa?.trim() || null,
      options:
        input.options === undefined
          ? undefined
          : ((input.options ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue),
      isMedical: input.isMedical,
      unit: input.unit === undefined ? undefined : input.unit?.trim() || null,
      showOnSignup: input.showOnSignup,
      promptEn: input.promptEn === undefined ? undefined : input.promptEn?.trim() || null,
      promptTa: input.promptTa === undefined ? undefined : input.promptTa?.trim() || null,
      rules:
        rules === undefined
          ? undefined
          : rules === null
            ? Prisma.JsonNull
            : (rules as unknown as Prisma.InputJsonValue),
    },
    select: FIELD_SELECT,
  });
}

/**
 * What may and may not change on a question the app has always asked.
 *
 * Labels, hints, section, order and the medical flag are free to change. What
 * is fixed is what the system itself depends on: the checks the answer must
 * pass (the server enforces its own, so a looser rule here would tell the
 * app to accept what the server then rejects), the unit, and — for the four
 * core questions — that they are asked, required, and asked at sign-up.
 */
function assertBuiltInEditIsAllowed(
  existing: { key: string; options: Prisma.JsonValue; fieldType: string },
  input: UpdateProfileFieldInput,
): void {
  if (input.rules !== undefined) {
    throw new ValidationError("The checks on a built-in question are fixed by the app.");
  }
  if (input.unit !== undefined) {
    throw new ValidationError("The unit of a built-in question is fixed by the app.");
  }

  if (isCoreBuiltIn(existing.key)) {
    if (input.active === false) {
      throw new ValidationError("This question is needed to sign up, so it cannot be switched off.");
    }
    if (input.required === false) {
      throw new ValidationError("This question is needed to sign up, so it cannot be optional.");
    }
    if (input.showOnSignup === false) {
      throw new ValidationError("This question is always asked when a parent signs up.");
    }
  }

  // A built-in choice stores the option's `value` in a real database column,
  // so the set of values is fixed. Wording and numbers may change.
  if (input.options !== undefined && existing.fieldType === "CHOICE") {
    const before = new Set(
      ((existing.options as unknown as ChoiceOption[] | null) ?? []).map((o) => o.value),
    );
    const after = new Set((input.options ?? []).map((o) => o.value));
    const same = before.size === after.size && [...before].every((value) => after.has(value));
    if (!same) {
      throw new ValidationError("The choices on a built-in question cannot be added or removed.");
    }
  }
}

/**
 * Merges a parent's answers into their child's `customFieldValues` and
 * validates them against the *currently active* field set only — an answer
 * under a retired field's key is left alone (not merged, not rejected), and
 * a required-but-missing active field blocks the save with a field-specific
 * message rather than a generic one.
 *
 * A shallow merge, not a replace: submitting one custom field must not wipe
 * the others a previous save already recorded.
 */
export async function mergeAndValidateCustomFieldValues(
  existing: Prisma.JsonValue,
  incoming: Record<string, string | number | null>,
): Promise<Record<string, string | number | null>> {
  const definitions = await listActiveProfileFieldDefinitions();
  const byKey = new Map(definitions.map((d) => [d.key, d]));

  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, string | number | null>) }
      : {};
  const merged = { ...base, ...incoming };

  for (const key of Object.keys(incoming)) {
    const def = byKey.get(key);
    if (!def) continue; // Unknown/retired key — stored as-is, not validated.
    const value = incoming[key];
    if (value === null || value === "") continue;

    if (def.fieldType === "CHOICE") {
      const options = (def.options as unknown as ChoiceOption[] | null) ?? [];
      if (!options.some((o) => o.value === value)) {
        throw new ValidationError(`"${def.labelEn}" has an invalid value.`);
      }
      continue;
    }

    // Type and rules together: the same checks the dashboard describes to
    // whoever set them, so what they wrote is what is enforced.
    const problem = checkAnswer(
      {
        labelEn: def.labelEn,
        fieldType: def.fieldType,
        rules: def.rules as unknown as ProfileFieldRules | null,
      },
      value,
      { answers: merged },
    );
    if (problem) throw new ValidationError(problem);
  }

  for (const def of definitions) {
    if (!def.required) continue;
    const value = merged[def.key];
    if (value === undefined || value === null || value === "") {
      throw new ValidationError(`"${def.labelEn}" is required.`);
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// What the app is given
// ---------------------------------------------------------------------------

/**
 * A question as the app receives it.
 *
 * Deliberately narrower than what the dashboard sees: no medical flag and no
 * per-choice calculator numbers. Those govern what a *calculator* may read and
 * mean nothing to the screen a parent fills in.
 */
const APP_QUESTION_SELECT = {
  id: true,
  key: true,
  fieldType: true,
  section: true,
  required: true,
  sortOrder: true,
  labelEn: true,
  labelTa: true,
  hintEn: true,
  hintTa: true,
  promptEn: true,
  promptTa: true,
  options: true,
  unit: true,
  builtIn: true,
  showOnSignup: true,
  rules: true,
} satisfies Prisma.ProfileFieldDefinitionSelect;

type AppQuestionRow = Prisma.ProfileFieldDefinitionGetPayload<{
  select: typeof APP_QUESTION_SELECT;
}>;

export type AppQuestion = Omit<AppQuestionRow, "options"> & {
  options: Array<{ value: string; labelEn: string; labelTa?: string }> | null;
};

function toAppQuestion(row: AppQuestionRow): AppQuestion {
  const options = Array.isArray(row.options)
    ? (row.options as unknown as ChoiceOption[]).map((option) => ({
        value: option.value,
        labelEn: option.labelEn,
        ...(option.labelTa ? { labelTa: option.labelTa } : {}),
      }))
    : null;
  return { ...row, options };
}

/**
 * The questions asked in the sign-up chat, in the order they are asked.
 *
 * Public, because sign-up happens before anyone is signed in. It exposes
 * nothing that is not already on screen in the app: wording, the kind of
 * answer, and what counts as a good one.
 */
export async function listSignupQuestions(): Promise<AppQuestion[]> {
  const rows = await prisma.profileFieldDefinition.findMany({
    where: { active: true, showOnSignup: true },
    select: APP_QUESTION_SELECT,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toAppQuestion);
}

/**
 * Every question the profile screen asks — built-in and added together, so the
 * app can draw the whole screen from one list.
 *
 * This is separate from `listActiveProfileFieldDefinitions` on purpose. That
 * one returns only *added* questions and is what older installs of the app
 * read; changing what it returns would make them show every built-in question
 * twice. This one is for versions of the app that know about `builtIn`.
 */
export async function listProfileQuestions(): Promise<AppQuestion[]> {
  const rows = await prisma.profileFieldDefinition.findMany({
    where: { active: true },
    select: APP_QUESTION_SELECT,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toAppQuestion);
}

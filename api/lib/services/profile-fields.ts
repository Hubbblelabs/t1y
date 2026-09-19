import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

/**
 * Admin-defined fields on the parent-facing profile form, on top of the
 * fixed set of columns [Profile] already has.
 *
 * Values a parent enters for these live in `Profile.customFieldValues`, a
 * JSON bucket keyed by [ProfileFieldDefinition.key] — see the schema's own
 * doc comment for why that's a bucket rather than a column per field.
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProfileFieldDefinitionSelect;

export type ProfileFieldDefinition = Prisma.ProfileFieldDefinitionGetPayload<{
  select: typeof FIELD_SELECT;
}>;

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export interface ChoiceOption {
  value: string;
  labelEn: string;
  labelTa?: string;
}

/** Admin view: every field, including inactive ones, oldest-defined first within each sort position. */
export async function listAllProfileFieldDefinitions(): Promise<ProfileFieldDefinition[]> {
  return prisma.profileFieldDefinition.findMany({
    select: FIELD_SELECT,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** App-facing view: only what a parent should currently be asked to fill in. */
export async function listActiveProfileFieldDefinitions(): Promise<ProfileFieldDefinition[]> {
  return prisma.profileFieldDefinition.findMany({
    where: { active: true },
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
    },
    select: FIELD_SELECT,
  });
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

    if (def.fieldType === "NUMBER" && typeof value !== "number") {
      throw new ValidationError(`"${def.labelEn}" must be a number.`);
    }
    if (def.fieldType === "CHOICE") {
      const options = (def.options as unknown as ChoiceOption[] | null) ?? [];
      if (!options.some((o) => o.value === value)) {
        throw new ValidationError(`"${def.labelEn}" has an invalid value.`);
      }
    }
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

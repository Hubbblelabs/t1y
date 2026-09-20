import { afterAll, describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import {
  listCatalogueVariables,
  resolveCatalogueValues,
} from "@/lib/services/health-data-catalogue";
import {
  createProfileFieldDefinition,
  listActiveProfileFieldDefinitions,
  listAllProfileFieldDefinitions,
  mergeAndValidateCustomFieldValues,
  updateProfileFieldDefinition,
} from "@/lib/services/profile-fields";

/**
 * The questions a parent is asked, against the development database.
 *
 * The built-in questions were registered from what the app hardcodes, so the
 * first group checks that transcription is complete. The properties that
 * matter most are the two that keep the live app working: built-ins must
 * never reach the app's own fetch, and must never join the save-time
 * "required" check — either would show a question twice and fail every
 * profile save.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test
 */

const createdFieldIds: string[] = [];
const restore: Array<() => Promise<unknown>> = [];
const testUserIds: string[] = [];

afterAll(async () => {
  for (const undo of restore.reverse()) await undo().catch(() => {});
  if (createdFieldIds.length > 0) {
    await prisma.profileFieldDefinition.deleteMany({ where: { id: { in: createdFieldIds } } });
  }
  // Every child a test created, not just the last one. Profiles go with them.
  if (testUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  }
});

async function builtIn(key: string) {
  const field = await prisma.profileFieldDefinition.findUnique({ where: { key } });
  if (!field?.builtIn) {
    throw new Error(`"${key}" is not registered. Run \`npm run profile:seed-builtin\`.`);
  }
  return field;
}

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

describe("The built-in questions", () => {
  it("registers every question the app asks", async () => {
    const keys = (await listAllProfileFieldDefinitions()).filter((f) => f.builtIn).map((f) => f.key);

    expect(keys.sort()).toEqual(
      [
        "name",
        "dateOfBirth",
        "sex",
        "diagnosisYear",
        "phone",
        "city",
        "country",
        "treatmentModality",
        "primaryClinician",
        "heightCm",
        "baselineWeightKg",
        "emergencyContactName",
        "emergencyContactPhone",
      ].sort(),
    );
  });

  it("asks exactly the four sign-up questions at sign-up", async () => {
    const atSignup = (await listAllProfileFieldDefinitions())
      .filter((f) => f.showOnSignup)
      .map((f) => f.key)
      .sort();
    expect(atSignup).toEqual(["dateOfBirth", "diagnosisYear", "name", "sex"]);
  });

  it("gives every sign-up question the sentence the chat asks", async () => {
    for (const key of ["name", "dateOfBirth", "sex", "diagnosisYear"]) {
      expect((await builtIn(key)).promptEn, key).toBeTruthy();
    }
  });

  it("records the type and checks the app enforces today", async () => {
    const name = await builtIn("name");
    expect(name.fieldType).toBe("TEXT");
    expect(name.rules).toMatchObject({ minLength: 2, maxLength: 80, format: "LETTERS" });

    const dob = await builtIn("dateOfBirth");
    expect(dob.fieldType).toBe("DATE");
    expect(dob.rules).toMatchObject({ notInFuture: true, minAgeYears: 0, maxAgeYears: 25 });

    const year = await builtIn("diagnosisYear");
    expect(year.fieldType).toBe("NUMBER");
    expect(year.rules).toMatchObject({ min: 1900, wholeNumber: true, notBeforeYearOf: "dateOfBirth" });

    const height = await builtIn("heightCm");
    expect(height.unit).toBe("cm");
    expect(height.rules).toMatchObject({ min: 50, max: 280 });
  });

  it("keeps the two sex choices the app offers, and no others", async () => {
    const sex = await builtIn("sex");
    const values = (sex.options as Array<{ value: string }>).map((o) => o.value);
    expect(values).toEqual(["FEMALE", "MALE"]);
  });

  it("starts with nothing marked as medical", async () => {
    // Whether height, weight or age may feed a dose is the study team's
    // decision, made in the dashboard — never a default.
    const marked = (await listAllProfileFieldDefinitions()).filter((f) => f.builtIn && f.isMedical);
    // Tolerate a test toggling one; none should be left on by the seed itself.
    expect(marked.length).toBeLessThanOrEqual(0);
  });
});

describe("Keeping the live app working", () => {
  it("never sends a built-in question to the app", async () => {
    const forTheApp = await listActiveProfileFieldDefinitions();
    expect(forTheApp.filter((f) => f.builtIn)).toEqual([]);
  });

  it("does not let a built-in question block a profile save", async () => {
    // "Child's name" is required and active, but its answer lives in a real
    // column. If it joined the required check, this would throw.
    await expect(mergeAndValidateCustomFieldValues({}, {})).resolves.toBeDefined();
  });
});

describe("Changing a built-in question", () => {
  it("cannot switch off, relax or move a sign-up question", async () => {
    for (const key of ["name", "dateOfBirth", "sex", "diagnosisYear"]) {
      const { id } = await builtIn(key);
      await expect(updateProfileFieldDefinition(id, { active: false })).rejects.toThrow(ValidationError);
      await expect(updateProfileFieldDefinition(id, { required: false })).rejects.toThrow(ValidationError);
      await expect(updateProfileFieldDefinition(id, { showOnSignup: false })).rejects.toThrow(ValidationError);
    }
  });

  it("cannot loosen what the app checks", async () => {
    const { id } = await builtIn("heightCm");
    await expect(
      updateProfileFieldDefinition(id, { rules: { min: 0, max: 9999 } }),
    ).rejects.toThrow(/fixed by the app/);
    await expect(updateProfileFieldDefinition(id, { unit: "inches" })).rejects.toThrow(/fixed by the app/);
  });

  it("cannot add or remove the choices stored in a database column", async () => {
    const treatment = await builtIn("treatmentModality");
    const options = treatment.options as Array<{ value: string; labelEn: string }>;

    await expect(
      updateProfileFieldDefinition(treatment.id, {
        options: [...options, { value: "HERBAL", labelEn: "Herbal" }],
      }),
    ).rejects.toThrow(/cannot be added or removed/);
    await expect(
      updateProfileFieldDefinition(treatment.id, { options: options.slice(1) }),
    ).rejects.toThrow(/cannot be added or removed/);
  });

  it("can change wording and the medical flag", async () => {
    const before = await builtIn("primaryClinician");
    restore.push(() =>
      updateProfileFieldDefinition(before.id, {
        labelEn: before.labelEn,
        isMedical: before.isMedical,
      }),
    );

    const changed = await updateProfileFieldDefinition(before.id, {
      labelEn: "Doctor looking after the child",
      isMedical: true,
    });
    expect(changed.labelEn).toBe("Doctor looking after the child");
    expect(changed.isMedical).toBe(true);
  });
});

describe("Questions added in the dashboard", () => {
  async function add(overrides: Parameters<typeof createProfileFieldDefinition>[0]) {
    const field = await createProfileFieldDefinition(overrides);
    createdFieldIds.push(field.id);
    return field;
  }

  it("holds a text answer to its length", async () => {
    const key = `testSchool${stamp()}`;
    await add({ key, fieldType: "TEXT", labelEn: "School", rules: { minLength: 3, maxLength: 10 } });

    await expect(mergeAndValidateCustomFieldValues({}, { [key]: "ab" })).rejects.toThrow(/at least 3/);
    await expect(mergeAndValidateCustomFieldValues({}, { [key]: "a".repeat(11) })).rejects.toThrow(/under 10/);
    await expect(mergeAndValidateCustomFieldValues({}, { [key]: "Greenwood" })).resolves.toBeDefined();
  });

  it("holds a number answer to its range and to whole numbers", async () => {
    const key = `testSiblings${stamp()}`;
    await add({ key, fieldType: "NUMBER", labelEn: "Siblings", rules: { min: 0, max: 12, wholeNumber: true } });

    await expect(mergeAndValidateCustomFieldValues({}, { [key]: 13 })).rejects.toThrow(/more than 12/);
    await expect(mergeAndValidateCustomFieldValues({}, { [key]: 1.5 })).rejects.toThrow(/whole number/);
    await expect(mergeAndValidateCustomFieldValues({}, { [key]: 2 })).resolves.toBeDefined();
  });

  it("refuses a date that cannot be right", async () => {
    const key = `testVisit${stamp()}`;
    await add({ key, fieldType: "DATE", labelEn: "Last clinic visit", rules: { notInFuture: true } });

    await expect(
      mergeAndValidateCustomFieldValues({}, { [key]: "2999-01-01" }),
    ).rejects.toThrow(/future/);
    await expect(mergeAndValidateCustomFieldValues({}, { [key]: "garbage" })).rejects.toThrow(/valid date/);
    await expect(
      mergeAndValidateCustomFieldValues({}, { [key]: "2025-05-01" }),
    ).resolves.toBeDefined();
  });

  it("refuses rules that belong to a different kind of answer", async () => {
    await expect(
      createProfileFieldDefinition({
        key: `testBad${stamp()}`,
        fieldType: "TEXT",
        labelEn: "Bad",
        rules: { min: 1, max: 5 },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("refuses a range that contradicts itself", async () => {
    await expect(
      createProfileFieldDefinition({
        key: `testBackwards${stamp()}`,
        fieldType: "NUMBER",
        labelEn: "Backwards",
        rules: { min: 10, max: 2 },
      }),
    ).rejects.toThrow(/cannot be more than the highest/);
  });

  it("cannot take the name of a built-in question", async () => {
    await expect(
      createProfileFieldDefinition({ key: "name", fieldType: "TEXT", labelEn: "Name again" }),
    ).rejects.toThrow(/already exists/);
  });

  it("is never mistaken for a built-in one", async () => {
    const field = await add({ key: `testPlain${stamp()}`, fieldType: "TEXT", labelEn: "Plain" });
    expect(field.builtIn).toBe(false);
  });

  it("can be asked at sign-up, with the sentence the chat uses", async () => {
    const field = await add({
      key: `testSchoolChat${stamp()}`,
      fieldType: "TEXT",
      labelEn: "School",
      showOnSignup: true,
      promptEn: "Which school does your child attend?",
    });
    expect(field.showOnSignup).toBe(true);
    expect(field.promptEn).toBe("Which school does your child attend?");
  });
});

describe("Built-in questions in calculators", () => {
  async function aChildWith(data: { heightCm?: number; dateOfBirth?: Date }) {
    const id = `test-profile-${stamp()}`;
    await prisma.user.create({
      data: { id, email: `${id}@example.test`, name: "Test Child", emailVerified: false },
    });
    testUserIds.push(id);
    await prisma.profile.create({
      data: { userId: id, participantCode: `T-${stamp()}`, name: "Test Child", ...data },
    });
    return id;
  }

  it("offers height only once it is marked as medical, from its own column", async () => {
    const height = await builtIn("heightCm");
    restore.push(() => updateProfileFieldDefinition(height.id, { isMedical: false }));

    await updateProfileFieldDefinition(height.id, { isMedical: false });
    expect((await listCatalogueVariables()).some((v) => v.key === "profile_heightCm")).toBe(false);

    await updateProfileFieldDefinition(height.id, { isMedical: true });
    const offered = (await listCatalogueVariables()).find((v) => v.key === "profile_heightCm");
    expect(offered?.unit).toBe("cm");

    // The value is read from Profile.heightCm, not the custom answers bucket.
    const userId = await aChildWith({ heightCm: 132 });
    const [resolved] = await resolveCatalogueValues(userId, ["profile_heightCm"]);
    expect(resolved.value).toBe(132);
  });

  it("says nothing when height was never entered, rather than zero", async () => {
    const userId = await aChildWith({});
    const [resolved] = await resolveCatalogueValues(userId, ["profile_heightCm"]);
    expect(resolved.value).toBeNull();
    expect(resolved.missingReason).toBeTruthy();
  });

  it("offers the child's age once the date of birth is marked as medical", async () => {
    const dob = await builtIn("dateOfBirth");
    restore.push(() => updateProfileFieldDefinition(dob.id, { isMedical: false }));

    await updateProfileFieldDefinition(dob.id, { isMedical: true });
    const age = (await listCatalogueVariables()).find((v) => v.key === "profile_age");
    expect(age?.unit).toBe("years");

    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    tenYearsAgo.setDate(tenYearsAgo.getDate() - 2);

    const userId = await aChildWith({ dateOfBirth: tenYearsAgo });
    const [resolved] = await resolveCatalogueValues(userId, ["profile_age"]);
    expect(resolved.value).toBe(10);
  });

  it("reports age as missing when there is no date of birth", async () => {
    const userId = await aChildWith({});
    const [resolved] = await resolveCatalogueValues(userId, ["profile_age"]);
    expect(resolved.value).toBeNull();
    expect(resolved.missingReason).toMatch(/date of birth/);
  });
});

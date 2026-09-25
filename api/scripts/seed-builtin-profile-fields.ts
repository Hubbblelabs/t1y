import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../generated/prisma/client";
import { describeRules, parseRules, type ProfileFieldType } from "../lib/services/profile-field-rules";

/**
 * Registers the questions the app already asks, so they can be seen and
 * described in the dashboard alongside any a coordinator adds.
 *
 * Until now every one of these lived only in Dart —
 * app/lib/models/signup_question.dart for the four sign-up questions and
 * app/lib/screens/profile/profile_edit_screen.dart for the rest — with its
 * validation scattered through both. This writes down what is asked, what
 * type each answer is, and what it must satisfy.
 *
 * ## What this changes, and what it does not
 *
 * It changes nothing a family sees. The app still asks these from its own
 * screens; these rows are not returned to it and are not part of the
 * save-time "required" check (see lib/services/profile-fields.ts). They are
 * the specification the app will be updated to read from — see
 * docs/WIRING-STATUS.md for exactly what that update involves.
 *
 * The rules are transcribed from the app's own validation, which is where
 * families actually meet them (the server's are looser in places; the note
 * against each says where).
 *
 * Every question starts with the medical flag OFF. Whether height, weight or
 * age may feed a dose calculation is a decision for the people running the
 * study, made deliberately in the dashboard — not a default this script
 * takes for them.
 *
 * Safe to run more than once: a question that already exists is left exactly
 * as it is, so nothing an admin has since changed is overwritten.
 *
 * Run with: npx tsx scripts/seed-builtin-profile-fields.ts
 * Add --dry-run to report what it would create without writing anything.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const dryRun = process.argv.includes("--dry-run");

interface BuiltIn {
  key: string;
  fieldType: ProfileFieldType;
  section: string;
  sortOrder: number;
  required: boolean;
  showOnSignup: boolean;
  labelEn: string;
  labelTa: string;
  promptEn?: string;
  promptTa?: string;
  unit?: string;
  rules?: Record<string, unknown>;
  options?: Array<{ value: string; labelEn: string; labelTa: string }>;
}

const ABOUT = "About the child";
const CONTACT = "Contact";
const TREATMENT = "Treatment";
const MEASUREMENTS = "Measurements";
const EMERGENCY = "Emergency contact";

const BUILT_INS: BuiltIn[] = [
  // ---- Asked when a parent signs up ---------------------------------------
  {
    key: "name",
    fieldType: "TEXT",
    section: ABOUT,
    sortOrder: 10,
    required: true,
    showOnSignup: true,
    labelEn: "Child's name",
    labelTa: "குழந்தையின் பெயர்",
    promptEn: "What is your child name?",
    promptTa: "உங்கள் குழந்தையின் பெயர் என்ன?",
    // The server allows 120; the app stops a family at 80 and letters only.
    rules: { minLength: 2, maxLength: 80, format: "LETTERS" },
  },
  {
    key: "dateOfBirth",
    fieldType: "DATE",
    section: ABOUT,
    sortOrder: 20,
    required: true,
    showOnSignup: true,
    labelEn: "Date of birth",
    labelTa: "பிறந்த தேதி",
    promptEn: "What is their date of birth?",
    promptTa: "அவர்களின் பிறந்த தேதி என்ன?",
    // The app's date picker on the profile screen only reaches back 20 years;
    // the sign-up chat accepts up to 25. The wider one is recorded.
    rules: { notInFuture: true, minAgeYears: 0, maxAgeYears: 25 },
  },
  {
    key: "sex",
    fieldType: "CHOICE",
    section: ABOUT,
    sortOrder: 30,
    required: true,
    showOnSignup: true,
    labelEn: "Sex",
    labelTa: "பாலினம்",
    promptEn: "Sex, for the medical record?",
    promptTa: "மருத்துவப் பதிவிற்கான பாலினம்?",
    // Values are what the database stores. "Prefer not to say" was deliberately
    // withdrawn as a choice; it survives only as a display fallback for older
    // records.
    options: [
      { value: "FEMALE", labelEn: "Female", labelTa: "பெண்" },
      { value: "MALE", labelEn: "Male", labelTa: "ஆண்" },
    ],
  },
  {
    key: "diagnosisYear",
    fieldType: "NUMBER",
    section: ABOUT,
    sortOrder: 40,
    required: true,
    showOnSignup: true,
    labelEn: "Year of diagnosis",
    labelTa: "கண்டறியப்பட்ட ஆண்டு",
    promptEn: "What year were they diagnosed with Type 1 diabetes?",
    promptTa: "எந்த ஆண்டில் டைப் 1 நீரிழிவு கண்டறியப்பட்டது?",
    rules: { min: 1900, wholeNumber: true, upToCurrentYear: true, notBeforeYearOf: "dateOfBirth" },
  },

  // ---- Asked later, on the profile screen ---------------------------------
  {
    key: "phone",
    fieldType: "TEXT",
    section: CONTACT,
    sortOrder: 50,
    required: false,
    showOnSignup: false,
    labelEn: "Phone",
    labelTa: "தொலைபேசி",
    rules: { maxLength: 32 },
  },
  {
    key: "city",
    fieldType: "TEXT",
    section: CONTACT,
    sortOrder: 60,
    required: false,
    showOnSignup: false,
    labelEn: "City",
    labelTa: "நகரம்",
    rules: { maxLength: 80 },
  },
  {
    key: "country",
    fieldType: "TEXT",
    section: CONTACT,
    sortOrder: 70,
    required: false,
    showOnSignup: false,
    labelEn: "Country",
    labelTa: "நாடு",
    rules: { maxLength: 80 },
  },
  {
    key: "treatmentModality",
    fieldType: "CHOICE",
    section: TREATMENT,
    sortOrder: 80,
    required: false,
    showOnSignup: false,
    labelEn: "Treatment",
    labelTa: "சிகிச்சை",
    // Values are the database enum. The app names the same six differently
    // (lifestyleOnly, oralMedication, …) and maps between them.
    options: [
      { value: "LIFESTYLE_ONLY", labelEn: "Lifestyle only", labelTa: "வாழ்க்கை முறை மட்டும்" },
      { value: "ORAL_MEDICATION", labelEn: "Oral medication", labelTa: "வாய்வழி மருந்து" },
      { value: "INSULIN", labelEn: "Insulin", labelTa: "இன்சுலின்" },
      { value: "ORAL_AND_INSULIN", labelEn: "Oral & insulin", labelTa: "வாய்வழி & இன்சுலின்" },
      {
        value: "NON_INSULIN_INJECTABLE",
        labelEn: "Non-insulin injectable",
        labelTa: "இன்சுலின் அல்லாத ஊசி மருந்து",
      },
      { value: "OTHER", labelEn: "Other", labelTa: "மற்றவை" },
    ],
  },
  {
    key: "primaryClinician",
    fieldType: "TEXT",
    section: TREATMENT,
    sortOrder: 90,
    required: false,
    showOnSignup: false,
    labelEn: "Treating doctor's name",
    labelTa: "சிகிச்சை அளிக்கும் மருத்துவரின் பெயர்",
    rules: { maxLength: 120 },
  },
  {
    key: "heightCm",
    fieldType: "NUMBER",
    section: MEASUREMENTS,
    sortOrder: 100,
    required: false,
    showOnSignup: false,
    labelEn: "Height",
    labelTa: "உயரம்",
    unit: "cm",
    rules: { min: 50, max: 280 },
  },
  {
    key: "baselineWeightKg",
    fieldType: "NUMBER",
    section: MEASUREMENTS,
    sortOrder: 110,
    required: false,
    showOnSignup: false,
    labelEn: "Weight",
    labelTa: "எடை",
    unit: "kg",
    rules: { min: 10, max: 500 },
  },
  {
    key: "emergencyContactName",
    fieldType: "TEXT",
    section: EMERGENCY,
    sortOrder: 120,
    required: false,
    showOnSignup: false,
    labelEn: "Emergency contact name",
    labelTa: "அவசர தொடர்பு பெயர்",
    rules: { maxLength: 120 },
  },
  {
    key: "emergencyContactPhone",
    fieldType: "TEXT",
    section: EMERGENCY,
    sortOrder: 130,
    required: false,
    showOnSignup: false,
    labelEn: "Emergency contact phone",
    labelTa: "அவசர தொடர்பு தொலைபேசி",
    rules: { maxLength: 32 },
  },
];

async function main() {
  // Every rule set goes through the same check the dashboard applies, so a
  // mistake in this file fails here rather than being stored.
  for (const field of BUILT_INS) {
    const parsed = parseRules(field.fieldType, field.rules ?? null);
    if (!parsed.ok) throw new Error(`${field.key}: ${parsed.message}`);
  }

  console.log(dryRun ? "Dry run — nothing will be written.\n" : "");
  let created = 0;
  let skipped = 0;

  for (const field of BUILT_INS) {
    const existing = await prisma.profileFieldDefinition.findUnique({
      where: { key: field.key },
      select: { id: true, builtIn: true },
    });

    if (existing) {
      const why = existing.builtIn ? "already present" : "a custom question already uses this name";
      console.log(`  = ${field.labelEn} (${field.key}) — ${why}, left alone`);
      skipped += 1;
      continue;
    }

    const said = describeRules(field.fieldType, field.rules ?? null, { unit: field.unit });
    console.log(
      `  + ${field.labelEn} — ${field.fieldType}${field.showOnSignup ? ", asked at sign-up" : ""}` +
        (said.length ? ` · ${said.join("; ")}` : ""),
    );

    if (!dryRun) {
      await prisma.profileFieldDefinition.create({
        data: {
          key: field.key,
          fieldType: field.fieldType,
          section: field.section,
          sortOrder: field.sortOrder,
          required: field.required,
          active: true,
          labelEn: field.labelEn,
          labelTa: field.labelTa,
          promptEn: field.promptEn ?? null,
          promptTa: field.promptTa ?? null,
          unit: field.unit ?? null,
          options: (field.options ?? undefined) as Prisma.InputJsonValue | undefined,
          rules: (field.rules ?? undefined) as Prisma.InputJsonValue | undefined,
          builtIn: true,
          showOnSignup: field.showOnSignup,
          isMedical: false,
        },
      });
    }
    created += 1;
  }

  console.log(`\n${dryRun ? "Would register" : "Registered"}: ${created}. Left alone: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

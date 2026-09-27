import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { validateFormula } from "../lib/utils/formula";

/**
 * The calculators the study documents describe — and no others.
 *
 * Every formula here is taken from the curriculum documents (Nutrition;
 * Insulin Types & Storage; Hypoglycaemia; Insulin Pump):
 *
 *   TDD              = the 7-day average of logged insulin (see TDD_FROM_RECORDS —
 *                      the app has no way to ask a parent to split a logged dose
 *                      into "basal" vs. "before breakfast" etc., so this is read
 *                      from real records rather than typed in as five fields)
 *   IC ratio         = 500 / TDD                       (grams of carb per unit)
 *   ISF, rapid       = 1800 / TDD                      (mg/dL per unit)
 *   ISF, short/reg.  = 1500 / TDD
 *   meal dose        = carbs / IC
 *   correction dose  = (current glucose − target glucose) / ISF
 *   mealtime insulin = meal dose + correction dose
 *   sugar for a low  = (target − current glucose) / 5  (1 g raises glucose ~5 mg/dL)
 *   40-unit syringe  = dose of a 100-unit insulin / 2.5
 *   pump basal       = 80% of TDD; hourly = daily / 24; 12–4 am × 0.5; 4–10 am × 1.5;
 *                      10 am–midnight × 1
 *
 * A parent only ever records three things in this app: a glucose reading, an
 * insulin dose, a meal's carbohydrates (see record_screen.dart) — never a
 * standing ratio like IC or ISF, and never a dose already split into
 * "basal" vs. "before breakfast" vs. "before lunch". So every input below is
 * either one of those three things typed fresh (carbs in *this* meal,
 * glucose right now if the day's reading is stale, the target their team set)
 * or filled in from what the app already has — the latest glucose reading,
 * or IC/ISF/TDD computed from the last week of logged doses — always shown
 * and always editable, with the time it was recorded beside it. Nothing here
 * asks for a number that isn't either freshly known or already on file; see
 * mealDose/correctionDose/totalMealtimeInsulin below for the formula chains
 * that replaced the manual IC/ISF fields this file used to have.
 *
 * Usage:
 *   npx tsx scripts/seed-standard-calculators.ts             add any that are missing
 *   npx tsx scripts/seed-standard-calculators.ts --replace   delete EVERY existing
 *                                                            calculator first, then add these
 *   add --dry-run to report without writing.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const dryRun = process.argv.includes("--dry-run");
const replace = process.argv.includes("--replace");

const NOTE_EN =
  "These are starting-point numbers from the standard formula. Your diabetes team should " +
  "confirm and adjust them for your child. Always check with them before changing a dose.";
const NOTE_TA =
  "இவை நிலையான சூத்திரத்திலிருந்து தொடக்க-புள்ளி எண்கள். உங்கள் நீரிழிவு குழு இவற்றை " +
  "உறுதிப்படுத்தி உங்கள் குழந்தைக்கேற்ப சரிசெய்ய வேண்டும். மருந்தளவை மாற்றும் முன் எப்போதும் " +
  "அவர்களிடம் உறுதிப்படுத்தவும்.";

type Input = {
  key: string;
  labelEn: string;
  labelTa: string;
  unit: string;
  min?: number;
  max?: number;
  decimals?: number;
  helpEn?: string;
  helpTa?: string;
  source?: "ASK" | "DATA";
  sourceKey?: string;
};
type Output = {
  key: string;
  labelEn: string;
  labelTa: string;
  unit: string;
  decimals: number;
  expression: string;
};

const TDD_FROM_RECORDS: Input = {
  key: "tdd",
  labelEn: "Total daily insulin dose",
  labelTa: "மொத்த தினசரி இன்சுலின் அளவு",
  unit: "units",
  min: 1,
  max: 200,
  decimals: 1,
  helpEn: "Basal plus every mealtime dose in 24 hours. Filled in from your logged doses; you can change it.",
  helpTa: "24 மணி நேரத்தில் பேசல் மற்றும் அனைத்து உணவு நேர அளவுகளின் கூட்டுத்தொகை. பதிவு செய்த அளவுகளிலிருந்து நிரப்பப்படுகிறது; மாற்றலாம்.",
  source: "DATA",
  sourceKey: "insulin_total_daily_dose",
};

const GLUCOSE_NOW: Input = {
  key: "glucose",
  labelEn: "Glucose now",
  labelTa: "தற்போதைய குளுக்கோஸ்",
  unit: "mg/dL",
  min: 20,
  max: 600,
  decimals: 0,
  source: "DATA",
  sourceKey: "glucose_latest",
};

const TARGET: Input = {
  key: "target",
  labelEn: "Target glucose",
  labelTa: "இலக்கு குளுக்கோஸ்",
  unit: "mg/dL",
  min: 60,
  max: 250,
  decimals: 0,
  helpEn: "The number your diabetes team wants before a meal, often 100–150.",
  helpTa: "உணவுக்கு முன் உங்கள் நீரிழிவு குழு விரும்பும் எண், பொதுவாக 100–150.",
};

const CARBS: Input = {
  key: "carbs",
  labelEn: "Carbohydrates in this meal",
  labelTa: "இந்த உணவில் உள்ள கார்போஹைட்ரேட்",
  unit: "g",
  min: 0,
  max: 500,
  decimals: 0,
};

const ratios = (rule: 1800 | 1500) => ({
  inputs: [TDD_FROM_RECORDS],
  outputs: [
    {
      key: "ic",
      labelEn: "Insulin-to-carb ratio — 1 unit covers this many grams",
      labelTa: "இன்சுலின்-கார்ப் விகிதம் — 1 யூனிட் இத்தனை கிராம்",
      unit: "g per unit",
      decimals: 1,
      expression: "500 / tdd",
    },
    {
      key: "isf",
      labelEn: "Correction factor — 1 unit lowers glucose by",
      labelTa: "திருத்தக் காரணி — 1 யூனிட் குளுக்கோஸைக் குறைக்கும் அளவு",
      unit: "mg/dL per unit",
      decimals: 0,
      expression: `${rule} / tdd`,
    },
  ] as Output[],
});

/**
 * The insulin-to-carb ratio, ISF and correction-factor formulas below all
 * used to be separate manual fields (`IC_INPUT`, `ISF_INPUT`) — asking a
 * parent to already know and re-type a precise ratio (e.g. "1 unit per
 * 12.5 g") every single time they wanted a meal dose. That number isn't
 * something the app has anywhere: a family only ever records three things —
 * a glucose reading, an insulin dose, a meal's carbohydrates (see
 * record_screen.dart) — never a standing ratio. The 500/1800/1500 rules
 * above compute exactly that ratio from the same logged-insulin average
 * (TDD_FROM_RECORDS) already used to seed it, so every calculator below
 * derives it the same way instead of asking for it a second time. It is
 * still shown as its own output line, not hidden, so a family can compare
 * it with whatever fixed number their diabetes team has actually prescribed
 * (see NOTE_EN).
 */
const insulinToCarb = {
  key: "ic",
  labelEn: "Insulin-to-carb ratio (500 rule)",
  labelTa: "இன்சுலின்-கார்ப் விகிதம் (500 விதி)",
  unit: "g per unit",
  decimals: 1,
  expression: "500 / tdd",
} as const;

const correctionFactor = (rule: 1800 | 1500) =>
  ({
    key: "isf",
    labelEn: `Correction factor (${rule} rule)`,
    labelTa: `திருத்தக் காரணி (${rule} விதி)`,
    unit: "mg/dL per unit",
    decimals: 0,
    expression: `${rule} / tdd`,
  }) as const;

/** carbs ÷ insulin-to-carb ratio — needs [CARBS, TDD_FROM_RECORDS] as inputs. */
const mealDose = () => ({
  inputs: [CARBS, TDD_FROM_RECORDS],
  outputs: [
    insulinToCarb,
    {
      key: "meal",
      labelEn: "Insulin for this meal",
      labelTa: "இந்த உணவுக்கான இன்சுலின்",
      unit: "units",
      decimals: 1,
      expression: "carbs / ic",
    },
  ] as Output[],
});

/** (glucose − target) ÷ correction factor — needs [GLUCOSE_NOW, TARGET, TDD_FROM_RECORDS]. */
const correctionDose = (rule: 1800 | 1500) => ({
  inputs: [GLUCOSE_NOW, TARGET, TDD_FROM_RECORDS],
  outputs: [
    correctionFactor(rule),
    {
      key: "correction",
      labelEn: "Correction (minus means take less)",
      labelTa: "திருத்தம் (கழித்தல் என்றால் குறைவாக எடுக்கவும்)",
      unit: "units",
      decimals: 1,
      expression: "(glucose - target) / isf",
    },
  ] as Output[],
});

/** Meal dose plus correction dose together — needs [CARBS, GLUCOSE_NOW, TARGET, TDD_FROM_RECORDS]. */
const totalMealtimeInsulin = (rule: 1800 | 1500) => ({
  inputs: [CARBS, GLUCOSE_NOW, TARGET, TDD_FROM_RECORDS],
  outputs: [
    insulinToCarb,
    correctionFactor(rule),
    {
      key: "meal",
      labelEn: "For the food",
      labelTa: "உணவுக்கு",
      unit: "units",
      decimals: 1,
      expression: "carbs / ic",
    },
    {
      key: "correction",
      labelEn: "For the glucose (minus means less)",
      labelTa: "குளுக்கோஸுக்கு (கழித்தல் என்றால் குறைவு)",
      unit: "units",
      decimals: 1,
      expression: "(glucose - target) / isf",
    },
    {
      key: "total",
      labelEn: "Total to take",
      labelTa: "மொத்தமாக எடுக்க வேண்டியது",
      unit: "units",
      decimals: 1,
      expression: "meal + correction",
    },
  ] as Output[],
});

const CALCULATORS: Array<{
  nameEn: string;
  nameTa: string;
  descriptionEn: string;
  descriptionTa: string;
  inputs: Input[];
  outputs: Output[];
}> = [
  {
    nameEn: "Total daily dose (TDD)",
    nameTa: "மொத்த தினசரி அளவு (TDD)",
    // Previously five manual fields — basal, before breakfast/lunch/dinner,
    // "any other dose" — added together. The app has never asked a parent to
    // categorise a logged dose that way (InsulinLog records what was taken
    // and when, not which of these five buckets it belongs to), so every one
    // of those fields showed up blank and had to be guessed or skipped every
    // time. TDD_FROM_RECORDS is the real number: the same seven-day average
    // of actually-logged insulin already powering the ratio and pump-basal
    // calculators below, auto-filled and still editable if the family knows
    // it should be different.
    descriptionEn:
      "Your child's usual total daily insulin, averaged from the last week of logged doses — the same number the ratio and pump calculators start from.",
    descriptionTa:
      "உங்கள் குழந்தையின் வழக்கமான மொத்த தினசரி இன்சுலின், கடந்த வார பதிவு செய்த அளவுகளின் சராசரி — விகித மற்றும் பம்ப் கால்குலேட்டர்கள் பயன்படுத்தும் அதே எண்.",
    inputs: [TDD_FROM_RECORDS],
    outputs: [
      {
        key: "total",
        labelEn: "Total daily dose",
        labelTa: "மொத்த தினசரி அளவு",
        unit: "units",
        decimals: 1,
        expression: "tdd",
      },
    ],
  },
  {
    nameEn: "Insulin ratios — rapid-acting insulin",
    nameTa: "இன்சுலின் விகிதங்கள் — வேகமாகச் செயல்படும் இன்சுலின்",
    descriptionEn:
      "The insulin-to-carb ratio (500 rule) and the correction factor (1800 rule) from the total daily dose. For Humalog, Novorapid and Apidra.",
    descriptionTa:
      "மொத்த தினசரி அளவிலிருந்து இன்சுலின்-கார்ப் விகிதம் (500 விதி) மற்றும் திருத்தக் காரணி (1800 விதி). ஹுமலாக், நோவோராபிட், அபிட்ரா இன்சுலினுக்கு.",
    ...ratios(1800),
  },
  {
    nameEn: "Insulin ratios — short-acting (regular) insulin",
    nameTa: "இன்சுலின் விகிதங்கள் — குறுகிய-செயல் (ரெகுலர்) இன்சுலின்",
    descriptionEn:
      "The insulin-to-carb ratio (500 rule) and the correction factor (1500 rule) from the total daily dose. For regular (yellow-label) insulin.",
    descriptionTa:
      "மொத்த தினசரி அளவிலிருந்து இன்சுலின்-கார்ப் விகிதம் (500 விதி) மற்றும் திருத்தக் காரணி (1500 விதி). ரெகுலர் (மஞ்சள் லேபிள்) இன்சுலினுக்கு.",
    ...ratios(1500),
  },
  {
    nameEn: "Mealtime dose from carbohydrates",
    nameTa: "கார்போஹைட்ரேட்டிலிருந்து உணவு நேர அளவு",
    // The insulin-to-carb ratio (the 500 rule) is the same formula for every
    // insulin type, so unlike the correction-dose calculators below this one
    // needs no rapid/regular split.
    descriptionEn:
      "How many units cover the carbohydrates in a meal, from carbs and your child's usual total daily dose.",
    descriptionTa:
      "ஒரு உணவில் உள்ள கார்போஹைட்ரேட்டையும் உங்கள் குழந்தையின் வழக்கமான மொத்த தினசரி அளவையும் கொண்டு, எத்தனை யூனிட் தேவை.",
    ...mealDose(),
  },
  {
    nameEn: "Correction dose — rapid-acting insulin",
    nameTa: "திருத்த அளவு — வேகமாகச் செயல்படும் இன்சுலின்",
    descriptionEn:
      "Extra insulin when glucose is above target, or less when it is below: (glucose now − target) ÷ correction factor (1800 rule). A minus answer means take that much less. For Humalog, Novorapid and Apidra.",
    descriptionTa:
      "குளுக்கோஸ் இலக்கை விட அதிகமாக இருந்தால் கூடுதல் இன்சுலின், குறைவாக இருந்தால் குறைவு: (தற்போதைய குளுக்கோஸ் − இலக்கு) ÷ திருத்தக் காரணி (1800 விதி). கழித்தல் குறி இருந்தால் அவ்வளவு குறைவாக எடுக்கவும். ஹுமலாக், நோவோராபிட், அபிட்ரா இன்சுலினுக்கு.",
    ...correctionDose(1800),
  },
  {
    nameEn: "Correction dose — short-acting (regular) insulin",
    nameTa: "திருத்த அளவு — குறுகிய-செயல் (ரெகுலர்) இன்சுலின்",
    descriptionEn:
      "Extra insulin when glucose is above target, or less when it is below: (glucose now − target) ÷ correction factor (1500 rule). A minus answer means take that much less. For regular (yellow-label) insulin.",
    descriptionTa:
      "குளுக்கோஸ் இலக்கை விட அதிகமாக இருந்தால் கூடுதல் இன்சுலின், குறைவாக இருந்தால் குறைவு: (தற்போதைய குளுக்கோஸ் − இலக்கு) ÷ திருத்தக் காரணி (1500 விதி). கழித்தல் குறி இருந்தால் அவ்வளவு குறைவாக எடுக்கவும். ரெகுலர் (மஞ்சள் லேபிள்) இன்சுலினுக்கு.",
    ...correctionDose(1500),
  },
  {
    nameEn: "Total mealtime insulin — rapid-acting insulin",
    nameTa: "மொத்த உணவு நேர இன்சுலின் — வேகமாகச் செயல்படும் இன்சுலின்",
    descriptionEn:
      "The meal dose plus the correction dose, worked out together (1800 rule). For Humalog, Novorapid and Apidra.",
    descriptionTa:
      "உணவு அளவு மற்றும் திருத்த அளவு, சேர்த்துக் கணக்கிடப்படுகிறது (1800 விதி). ஹுமலாக், நோவோராபிட், அபிட்ரா இன்சுலினுக்கு.",
    ...totalMealtimeInsulin(1800),
  },
  {
    nameEn: "Total mealtime insulin — short-acting (regular) insulin",
    nameTa: "மொத்த உணவு நேர இன்சுலின் — குறுகிய-செயல் (ரெகுலர்) இன்சுலின்",
    descriptionEn:
      "The meal dose plus the correction dose, worked out together (1500 rule). For regular (yellow-label) insulin.",
    descriptionTa:
      "உணவு அளவு மற்றும் திருத்த அளவு, சேர்த்துக் கணக்கிடப்படுகிறது (1500 விதி). ரெகுலர் (மஞ்சள் லேபிள்) இன்சுலினுக்கு.",
    ...totalMealtimeInsulin(1500),
  },
  {
    nameEn: "Sugar needed to treat a low",
    nameTa: "குறைந்த சர்க்கரையைச் சரிசெய்யத் தேவையான சர்க்கரை",
    descriptionEn:
      "Grams of sugar to bring a low up to a target, since 1 gram raises glucose by about 5 mg/dL. Recheck after 15 minutes.",
    descriptionTa:
      "குறைந்த சர்க்கரையை இலக்குக்குக் கொண்டுவரத் தேவையான சர்க்கரை (கிராம்); 1 கிராம் சுமார் 5 mg/dL உயர்த்தும். 15 நிமிடம் கழித்து மீண்டும் சோதிக்கவும்.",
    inputs: [
      { ...GLUCOSE_NOW, min: 20, max: 200 },
      { ...TARGET, min: 70, max: 200, helpEn: "Usually 100.", helpTa: "பொதுவாக 100." },
    ],
    outputs: [
      {
        key: "sugar",
        labelEn: "Sugar needed",
        labelTa: "தேவையான சர்க்கரை",
        unit: "g",
        decimals: 0,
        expression: "max((target - glucose) / 5, 0)",
      },
    ],
  },
  {
    nameEn: "40-unit syringe with 100-unit insulin",
    nameTa: "100-யூனிட் இன்சுலினுக்கு 40-யூனிட் சிரிஞ்ச்",
    descriptionEn:
      "If only a 40-unit syringe is available for a 100-unit insulin such as Lantus, the dose is divided by 2.5. Use a 100-unit syringe whenever you can.",
    descriptionTa:
      "லாண்டஸ் போன்ற 100-யூனிட் இன்சுலினுக்கு 40-யூனிட் சிரிஞ்ச் மட்டுமே இருந்தால், அளவை 2.5 ஆல் வகுக்கவும். முடிந்தவரை 100-யூனிட் சிரிஞ்சையே பயன்படுத்தவும்.",
    inputs: [
      {
        key: "dose",
        labelEn: "Dose of the 100-unit insulin",
        labelTa: "100-யூனிட் இன்சுலின் அளவு",
        unit: "units",
        min: 0.5,
        max: 100,
        decimals: 1,
      },
    ],
    outputs: [
      {
        key: "draw",
        labelEn: "Dial on the 40-unit syringe",
        labelTa: "40-யூனிட் சிரிஞ்சில் எடுக்க வேண்டியது",
        unit: "units",
        decimals: 1,
        expression: "dose / 2.5",
      },
    ],
  },
  {
    nameEn: "Insulin pump basal rates",
    nameTa: "இன்சுலின் பம்ப் பேசல் விகிதங்கள்",
    descriptionEn:
      "A starting basal plan: 80% of the total daily dose spread over 24 hours, half from 12 to 4 am, one and a half times from 4 to 10 am, and the hourly rate for the rest of the day.",
    descriptionTa:
      "தொடக்க பேசல் திட்டம்: மொத்த தினசரி அளவில் 80% ஐ 24 மணிநேரத்தில் பிரிக்கவும்; நள்ளிரவு 12 முதல் 4 மணி வரை பாதி, காலை 4 முதல் 10 மணி வரை ஒன்றரை மடங்கு, மீதி நேரம் மணிநேர விகிதம்.",
    inputs: [TDD_FROM_RECORDS],
    outputs: [
      {
        key: "daily",
        labelEn: "Basal for the whole day (80%)",
        labelTa: "முழு நாளுக்கான பேசல் (80%)",
        unit: "units",
        decimals: 1,
        expression: "tdd * 0.8",
      },
      {
        key: "hourly",
        labelEn: "Hourly rate",
        labelTa: "மணிநேர விகிதம்",
        unit: "units per hour",
        decimals: 2,
        expression: "daily / 24",
      },
      {
        key: "night",
        labelEn: "12 am to 4 am (half)",
        labelTa: "நள்ளிரவு 12 முதல் 4 மணி வரை (பாதி)",
        unit: "units per hour",
        decimals: 2,
        expression: "hourly * 0.5",
      },
      {
        key: "dawn",
        labelEn: "4 am to 10 am (one and a half times)",
        labelTa: "காலை 4 முதல் 10 மணி வரை (ஒன்றரை மடங்கு)",
        unit: "units per hour",
        decimals: 2,
        expression: "hourly * 1.5",
      },
      {
        key: "day",
        labelEn: "10 am to midnight",
        labelTa: "காலை 10 முதல் நள்ளிரவு வரை",
        unit: "units per hour",
        decimals: 2,
        expression: "hourly",
      },
    ],
  },
];

function generateKey(name: string): string {
  const stem = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${stem}-${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  // The same check the dashboard applies, so a mistake here fails here.
  let invalid = 0;
  for (const calculator of CALCULATORS) {
    const names = calculator.inputs.map((input) => input.key);
    for (const output of calculator.outputs) {
      const problem = validateFormula(output.expression, names);
      if (problem) {
        console.error(`  ✗ ${calculator.nameEn} → ${output.key}: ${problem}`);
        invalid += 1;
      }
      names.push(output.key);
    }
  }
  if (invalid > 0) {
    throw new Error(`${invalid} formula(s) failed validation. Nothing was written.`);
  }

  const author = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!author) {
    throw new Error("No administrator account exists to own these. Run `npm run db:seed` first.");
  }

  console.log(`Owner: ${author.email}`);
  console.log(dryRun ? "Dry run — nothing will be written.\n" : "");

  if (replace) {
    const existing = await prisma.calculator.count();
    console.log(`${dryRun ? "Would delete" : "Deleting"} ${existing} existing calculator(s).`);
    if (!dryRun) await prisma.calculator.deleteMany({});
  }

  let created = 0;
  let skipped = 0;

  for (const [index, calculator] of CALCULATORS.entries()) {
    const existing = replace
      ? null
      : await prisma.calculator.findFirst({
          where: { nameEn: calculator.nameEn },
          select: { id: true },
        });

    if (existing) {
      console.log(`  = ${calculator.nameEn} — already present, left alone`);
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.calculator.create({
        data: {
          key: generateKey(calculator.nameEn),
          nameEn: calculator.nameEn,
          nameTa: calculator.nameTa,
          descriptionEn: calculator.descriptionEn,
          descriptionTa: calculator.descriptionTa,
          inputs: calculator.inputs,
          outputs: calculator.outputs,
          noteEn: NOTE_EN,
          noteTa: NOTE_TA,
          sortOrder: index,
          createdById: author.id,
        },
      });
    }

    console.log(`  + ${calculator.nameEn}`);
    for (const output of calculator.outputs) {
      console.log(`      ${output.key} = ${output.expression}`);
    }
    created += 1;
  }

  console.log(`\n${dryRun ? "Would create" : "Created"}: ${created}. Left alone: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

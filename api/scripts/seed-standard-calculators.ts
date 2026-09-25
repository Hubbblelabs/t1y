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
 *   TDD              = basal + every bolus over 24 hours
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
 * Parents type what a calculator needs. Where the phone already holds a
 * number (the latest glucose reading, the usual daily insulin total) it is
 * filled in and stays editable, with the time it was recorded beside it.
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

// A dose entered as 0 is allowed (a child may skip one), so these take a
// minimum of 0. Everything else refuses zero and negatives by default.
const dose = (key: string, en: string, ta: string): Input => ({
  key,
  labelEn: en,
  labelTa: ta,
  unit: "units",
  min: 0,
  max: 100,
  decimals: 1,
});

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

const IC_INPUT: Input = {
  key: "ic",
  labelEn: "Insulin-to-carb ratio (grams covered by 1 unit)",
  labelTa: "இன்சுலின்-கார்ப் விகிதம் (1 யூனிட் ஈடுசெய்யும் கிராம்)",
  unit: "g per unit",
  min: 1,
  max: 150,
  decimals: 1,
};

const ISF_INPUT: Input = {
  key: "isf",
  labelEn: "Correction factor (mg/dL lowered by 1 unit)",
  labelTa: "திருத்தக் காரணி (1 யூனிட் குறைக்கும் mg/dL)",
  unit: "mg/dL per unit",
  min: 1,
  max: 600,
  decimals: 0,
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
    descriptionEn: "Adds up all the insulin taken in 24 hours: the basal dose plus every mealtime dose.",
    descriptionTa: "24 மணி நேரத்தில் எடுத்த அனைத்து இன்சுலினையும் கூட்டுகிறது: பேசல் அளவு மற்றும் ஒவ்வொரு உணவு நேர அளவு.",
    inputs: [
      dose("basal", "Basal (long-acting) insulin", "பேசல் (நீண்ட நேர) இன்சுலின்"),
      dose("breakfast", "Before breakfast", "காலை உணவுக்கு முன்"),
      dose("lunch", "Before lunch (or school break)", "மதிய உணவுக்கு முன் (அல்லது பள்ளி இடைவேளை)"),
      dose("dinner", "Before dinner", "இரவு உணவுக்கு முன்"),
      dose("other", "Any other dose (snack, correction)", "வேறு அளவு (சிற்றுண்டி, திருத்தம்)"),
    ],
    outputs: [
      {
        key: "tdd",
        labelEn: "Total daily dose",
        labelTa: "மொத்த தினசரி அளவு",
        unit: "units",
        decimals: 1,
        expression: "basal + breakfast + lunch + dinner + other",
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
    descriptionEn: "How many units cover the carbohydrates in a meal: carbs ÷ insulin-to-carb ratio.",
    descriptionTa: "ஒரு உணவில் உள்ள கார்போஹைட்ரேட்டை ஈடுசெய்ய எத்தனை யூனிட்: கார்ப் ÷ இன்சுலின்-கார்ப் விகிதம்.",
    inputs: [CARBS, IC_INPUT],
    outputs: [
      {
        key: "meal",
        labelEn: "Insulin for this meal",
        labelTa: "இந்த உணவுக்கான இன்சுலின்",
        unit: "units",
        decimals: 1,
        expression: "carbs / ic",
      },
    ],
  },
  {
    nameEn: "Correction dose for glucose before a meal",
    nameTa: "உணவுக்கு முன் குளுக்கோஸுக்கான திருத்த அளவு",
    descriptionEn:
      "Extra insulin when glucose is above target, or less when it is below: (glucose now − target) ÷ correction factor. A minus answer means take that much less.",
    descriptionTa:
      "குளுக்கோஸ் இலக்கை விட அதிகமாக இருந்தால் கூடுதல் இன்சுலின், குறைவாக இருந்தால் குறைவு: (தற்போதைய குளுக்கோஸ் − இலக்கு) ÷ திருத்தக் காரணி. கழித்தல் குறி இருந்தால் அவ்வளவு குறைவாக எடுக்கவும்.",
    inputs: [GLUCOSE_NOW, TARGET, ISF_INPUT],
    outputs: [
      {
        key: "correction",
        labelEn: "Correction (minus means take less)",
        labelTa: "திருத்தம் (கழித்தல் என்றால் குறைவாக எடுக்கவும்)",
        unit: "units",
        decimals: 1,
        expression: "(glucose - target) / isf",
      },
    ],
  },
  {
    nameEn: "Total mealtime insulin",
    nameTa: "மொத்த உணவு நேர இன்சுலின்",
    descriptionEn: "The meal dose plus the correction dose, worked out together.",
    descriptionTa: "உணவு அளவு மற்றும் திருத்த அளவு, சேர்த்துக் கணக்கிடப்படுகிறது.",
    inputs: [CARBS, IC_INPUT, GLUCOSE_NOW, TARGET, ISF_INPUT],
    outputs: [
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
    ],
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

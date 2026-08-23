import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * Seeds a small number of hand-authored quizzes from the source curriculum
 * documents (SMBG true/false, Hypoglycaemia sequencing, Insulin Types
 * matching).
 *
 * These are transcribed and reviewed by a human, not heuristically parsed —
 * per the import design, a wrong answer key in a paediatric diabetes
 * education study is real harm, not a bug, so nothing auto-generates a quiz
 * answer key straight into the database. Run once to demonstrate the full
 * pipeline end-to-end; the remaining quiz content (per the BRD, most of the
 * 8 topics end in a quiz or FAQ) should be authored through the admin
 * Content → Quizzes UI, transcribing from the same source documents.
 *
 * Run with: npx tsx scripts/seed-quizzes.ts
 */

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type QuestionType = "SINGLE_CHOICE" | "TRUE_FALSE" | "MATCHING" | "ORDERING";

interface OptionInput {
  text: string;
  matchText?: string;
  isCorrect?: boolean;
  correctPosition?: number;
}
interface QuestionInput {
  type: QuestionType;
  questionKey: string;
  prompt: string;
  explanation?: string;
  points?: number;
  position: number;
  options: OptionInput[];
}
interface QuizInput {
  slug: string;
  locale: "EN" | "TA";
  topicSlug: string;
  title: string;
  description?: string;
  passingScore: number | null;
  questions: QuestionInput[];
}

function trueFalse(
  key: string,
  prompt: string,
  answerIsTrue: boolean,
  position: number,
): QuestionInput {
  return {
    type: "TRUE_FALSE",
    questionKey: key,
    prompt,
    position,
    options: [
      { text: "True", isCorrect: answerIsTrue },
      { text: "False", isCorrect: !answerIsTrue },
    ],
  };
}

// Transcribed from "SMBG- Self monitoring of blood glucose" — the article's
// own true/false quiz, 15 items.
const smbgQuiz: QuizInput = {
  slug: "smbg-quiz",
  locale: "EN",
  topicSlug: "glucose-monitoring",
  title: "SMBG — Quiz",
  description: "True or false, based on the Self-Monitoring of Blood Glucose article.",
  passingScore: 70,
  questions: [
    trueFalse("q1", "Blood sugar checked on a glucometer is not trustworthy.", false, 0),
    trueFalse("q2", "Handwashing is necessary before a blood sugar check.", true, 1),
    trueFalse("q3", "A glucometer needs to be calibrated / cross-checked 5–6 times a month.", true, 2),
    trueFalse("q4", "You should apply spirit to your finger right before a blood sugar check.", false, 3),
    trueFalse("q5", "Glucose strips can be used even after their expiry date.", false, 4),
    trueFalse("q6", "If blood is not adequate for a check, you should squeeze your finger.", false, 5),
    trueFalse("q7", "You should prick the middle portion of the finger for a sugar check.", false, 6),
    trueFalse("q8", "You should always use the same finger for a sugar check.", false, 7),
    trueFalse("q9", "If HbA1c is in the correct range, there's no need for frequent sugar checks.", false, 8),
    trueFalse(
      "q10",
      "Checking blood sugar frequently at home can help avoid hospitalisation in an emergency such as hypoglycaemia or DKA.",
      true,
      9,
    ),
    trueFalse(
      "q11",
      "Blood sugar can fluctuate for many everyday reasons, and a glucometer makes managing diabetes possible.",
      true,
      10,
    ),
    trueFalse("q12", "When sick, you should check your blood sugar every 2–3 hours.", true, 11),
    trueFalse(
      "q13",
      "Because of SMBG, a person with Type 1 diabetes can adjust their daily routine, diet and insulin dose.",
      true,
      12,
    ),
    trueFalse(
      "q14",
      "Along with the person who has Type 1 diabetes, their family should also know about the glucometer in detail.",
      true,
      13,
    ),
    trueFalse("q15", "If a glucometer shows HI or LO, that means the glucometer is damaged.", false, 14),
  ],
};

// Transcribed from "Hypoglycaemia — Management and Prevention"'s sequencing
// quiz: put the response steps in the right order.
const hypoglycaemiaQuiz: QuizInput = {
  slug: "hypoglycaemia-sequence-quiz",
  locale: "EN",
  topicSlug: "hypoglycaemia",
  title: "Hypoglycaemia — What to Do, In Order",
  description: "Put the steps for responding to a hypo symptom in the correct order.",
  passingScore: 70,
  questions: [
    {
      type: "ORDERING",
      questionKey: "sequence",
      prompt: "You notice symptoms of a hypo. Put these steps in the correct order.",
      explanation:
        "Check first if you can, treat low sugar immediately with fast carbs, recheck in 15–20 minutes, " +
        "follow up with heavy food once recovered, then work out why it happened so it can be prevented.",
      position: 0,
      options: [
        { text: "If possible, check your blood sugar on the glucometer.", correctPosition: 1 },
        {
          text: "If your blood glucose is <80, eat something (15g carbs) to raise it quickly.",
          correctPosition: 2,
        },
        { text: "Check blood glucose again in 15 to 20 minutes.", correctPosition: 3 },
        {
          text: "If it's still <100 after 15–20 minutes, eat another 15g of fast carbs.",
          correctPosition: 4,
        },
        { text: "Once blood glucose is >100, eat something heavier, like bread.", correctPosition: 5 },
        { text: "Find the reason for the hypo.", correctPosition: 6 },
        {
          text: "Consult your diabetes team to prevent recurrence and review diet/exercise/insulin.",
          correctPosition: 7,
        },
      ],
    },
  ],
};

// Transcribed from "Insulin-Types, Storage" — a representative subset of the
// brand-matching quiz (the source lists 17 brands; this keeps to the
// MATCHING question's practical size and picks distinct, unambiguous pairs).
const insulinTypesQuiz: QuizInput = {
  slug: "insulin-types-quiz",
  locale: "EN",
  topicSlug: "insulin-basics",
  title: "Insulin Types — Match the Insulin",
  description: "Match each insulin to its description.",
  passingScore: 70,
  questions: [
    {
      type: "MATCHING",
      questionKey: "match1",
      prompt: "Match each insulin to its correct description.",
      position: 0,
      options: [
        { text: "Insulin R (Regular)", matchText: "Yellow label, clear liquid, starts working in 30–45 min" },
        { text: "Insulin N (NPH)", matchText: "Green label, milky, starts working in 4–6 hours" },
        { text: "Lantus", matchText: "Long-acting, controls fasting glucose for 22–24 hours" },
        { text: "Novorapid", matchText: "Rapid-acting analogue, starts working in 5–10 minutes" },
        { text: "Mixtard 30/70", matchText: "Premixed combination of R and N insulin" },
      ],
    },
  ],
};

async function ensureAuthor(): Promise<string> {
  const email = process.env.IMPORT_AUTHOR_EMAIL;
  if (!email) throw new Error("IMPORT_AUTHOR_EMAIL is not set.");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`IMPORT_AUTHOR_EMAIL "${email}" does not exist. Run \`npm run db:seed\` first.`);
  return user.id;
}

async function upsertQuiz(authorId: string, input: QuizInput) {
  const existing = await prisma.quiz.findUnique({
    where: { slug_locale: { slug: input.slug, locale: input.locale } },
    select: { id: true },
  });

  if (existing) {
    console.log(`  = ${input.slug}: already exists, skipping (delete it in the CMS to re-seed)`);
    return;
  }

  await prisma.quiz.create({
    data: {
      slug: input.slug,
      locale: input.locale,
      topicSlug: input.topicSlug,
      title: input.title,
      description: input.description,
      passingScore: input.passingScore,
      status: "DRAFT",
      authorId,
      questions: {
        create: input.questions.map((q) => ({
          type: q.type,
          questionKey: q.questionKey,
          prompt: q.prompt,
          explanation: q.explanation,
          points: q.points ?? 1,
          position: q.position,
          options: {
            create: q.options.map((o, index) => ({
              position: index,
              text: o.text,
              matchText: o.matchText,
              isCorrect: o.isCorrect ?? false,
              correctPosition: o.correctPosition,
            })),
          },
        })),
      },
    },
  });
  console.log(`  ✓ ${input.slug}: created (${input.questions.length} question(s))`);
}

async function main() {
  console.log("Seeding hand-authored quizzes…");
  const authorId = await ensureAuthor();
  for (const quiz of [smbgQuiz, hypoglycaemiaQuiz, insulinTypesQuiz]) {
    await upsertQuiz(authorId, quiz);
  }
  console.log("\nDone. Quizzes are DRAFT — review and publish via the admin CMS.");
}

main()
  .catch((error) => {
    console.error("Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

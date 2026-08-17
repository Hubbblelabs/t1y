import { z } from "zod";

import { paginationSchema, searchSchema, shortTextSchema } from "@/lib/validation/common";
import { contentLocaleSchema, contentStatusSchema, slugSchema } from "@/lib/validation/admin";

/**
 * Quiz authoring and submission schemas.
 *
 * Question validity is enforced here, not in the service layer — this is
 * where a malformed answer key gets caught before it ever reaches a
 * participant's device. Each question type carries the invariant that makes
 * it gradable:
 *   SINGLE_CHOICE / TRUE_FALSE — exactly one option marked correct
 *   TRUE_FALSE                — exactly two options
 *   MATCHING                  — every option carries a matchText
 *   ORDERING                  — correctPosition is a permutation of 1..n
 */

export const quizQuestionTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "TRUE_FALSE",
  "MATCHING",
  "ORDERING",
]);

const baseOptionSchema = z.object({
  text: shortTextSchema(300),
  matchText: z.string().trim().max(300).optional(),
  isCorrect: z.boolean().default(false),
  correctPosition: z.number().int().min(1).max(50).optional(),
});

const baseQuestionSchema = z.object({
  /** Stable across the EN/TA pair of a question — see schema comment. */
  questionKey: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only."),
  prompt: shortTextSchema(1000),
  explanation: z.string().trim().max(2000).optional(),
  imageUrl: z.url().max(2000).optional(),
  points: z.number().int().min(1).max(20).default(1),
  position: z.number().int().min(0).max(500),
});

export const quizQuestionSchema = z
  .discriminatedUnion("type", [
    baseQuestionSchema.extend({
      type: z.literal("SINGLE_CHOICE"),
      options: z.array(baseOptionSchema).min(2).max(8),
    }),
    baseQuestionSchema.extend({
      type: z.literal("TRUE_FALSE"),
      options: z.array(baseOptionSchema).length(2),
    }),
    baseQuestionSchema.extend({
      type: z.literal("MATCHING"),
      options: z.array(baseOptionSchema).min(2).max(8),
    }),
    baseQuestionSchema.extend({
      type: z.literal("ORDERING"),
      options: z.array(baseOptionSchema).min(2).max(10),
    }),
  ])
  .superRefine((question, ctx) => {
    if (question.type === "SINGLE_CHOICE" || question.type === "TRUE_FALSE") {
      const correctCount = question.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: `${question.type} requires exactly one correct option (found ${correctCount}).`,
        });
      }
    }

    if (question.type === "MATCHING") {
      const missing = question.options.filter((o) => !o.matchText?.trim());
      if (missing.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Every MATCHING option requires matchText.",
        });
      }
    }

    if (question.type === "ORDERING") {
      const positions = question.options
        .map((o) => o.correctPosition)
        .filter((p): p is number => p !== undefined);
      const expected = question.options.length;
      const isPermutation =
        positions.length === expected &&
        new Set(positions).size === expected &&
        Math.min(...positions) === 1 &&
        Math.max(...positions) === expected;
      if (!isPermutation) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: `ORDERING requires correctPosition to be a permutation of 1..${expected}.`,
        });
      }
    }
  });

export const createQuizSchema = z.object({
  slug: slugSchema,
  locale: contentLocaleSchema.default("EN"),
  /** EducationContent.slug this quiz reinforces, if any. */
  topicSlug: slugSchema.optional(),
  title: shortTextSchema(200),
  description: z.string().trim().max(1000).optional(),
  passingScore: z.number().int().min(0).max(100).nullish(),
  maxAttempts: z.number().int().min(0).max(20).default(0),
  shuffleQuestions: z.boolean().default(false),
  status: contentStatusSchema.default("DRAFT"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  questions: z.array(quizQuestionSchema).min(1).max(50),
});

/** `locale` and `slug` are immutable after creation, same rationale as education content. */
export const updateQuizSchema = createQuizSchema
  .partial()
  .omit({ locale: true, slug: true });

export const quizListQuerySchema = z
  .object({
    status: contentStatusSchema.optional(),
    locale: contentLocaleSchema.optional(),
    topicSlug: slugSchema.optional(),
    search: searchSchema,
  })
  .and(paginationSchema);

// ---------------------------------------------------------------------------
// Participant submission (offline sync payload — see lib/validation/sync.ts)
// ---------------------------------------------------------------------------

export const questionAnswerSchema = z.union([
  z.object({ optionId: z.string().min(1).max(64) }),
  z.object({
    pairs: z
      .array(
        z.object({
          optionId: z.string().min(1).max(64),
          matchOptionId: z.string().min(1).max(64),
        }),
      )
      .max(8),
  }),
  z.object({ order: z.array(z.string().min(1).max(64)).max(10) }),
]);

import { describe, expect, it } from "vitest";

import { publicLocaleSchema } from "@/lib/validation/content";
import {
  createEducationSchema,
  updateEducationSchema,
  educationListQuerySchema,
} from "@/lib/validation/admin";
import { createQuizSchema, quizQuestionSchema } from "@/lib/validation/quizzes";
import { syncPushSchema, MAX_SYNC_BATCH } from "@/lib/validation/sync";

describe("publicLocaleSchema", () => {
  it("defaults to en and uppercases for storage", () => {
    expect(publicLocaleSchema.parse(undefined)).toBe("EN");
  });

  it("accepts ta and uppercases it", () => {
    expect(publicLocaleSchema.parse("ta")).toBe("TA");
  });

  it("rejects an unsupported locale", () => {
    expect(() => publicLocaleSchema.parse("fr")).toThrow();
  });
});

describe("education content locale schemas", () => {
  const base = {
    slug: "insulin-basics",
    title: "Insulin Basics",
    category: "INSULIN" as const,
    body: "<p>placeholder</p>",
  };

  it("defaults locale to EN on create", () => {
    const parsed = createEducationSchema.parse(base);
    expect(parsed.locale).toBe("EN");
  });

  it("accepts an explicit TA locale on create", () => {
    const parsed = createEducationSchema.parse({ ...base, locale: "TA" });
    expect(parsed.locale).toBe("TA");
  });

  it("rejects locale on update — it must never be changed after creation", () => {
    // TypeScript already prevents passing `locale` (the field is omitted from
    // the update schema's type), but assert the *runtime* schema strips it
    // too rather than silently accepting and ignoring an extra key.
    const parsed = updateEducationSchema.parse({ title: "New title", locale: "TA" } as never);
    expect(parsed).not.toHaveProperty("locale");
  });

  it("accepts a locale filter on the admin list query", () => {
    const parsed = educationListQuerySchema.parse({ locale: "TA" });
    expect(parsed.locale).toBe("TA");
  });

  it("accepts every newly added Help Book category", () => {
    for (const category of ["HYPOGLYCAEMIA", "SCHOOL_MANAGEMENT", "TRAVEL", "DIABAG"]) {
      expect(createEducationSchema.parse({ ...base, category })).toMatchObject({ category });
    }
  });
});

describe("quiz question validation — the answer-key invariants", () => {
  const baseQuestion = {
    questionKey: "q1",
    prompt: "Which insulin is rapid-acting?",
    position: 0,
  };

  it("accepts a SINGLE_CHOICE question with exactly one correct option", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "SINGLE_CHOICE",
        options: [
          { text: "Novorapid", isCorrect: true },
          { text: "Lantus", isCorrect: false },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects a SINGLE_CHOICE question with zero correct options", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "SINGLE_CHOICE",
        options: [
          { text: "Novorapid", isCorrect: false },
          { text: "Lantus", isCorrect: false },
        ],
      }),
    ).toThrow();
  });

  it("rejects a SINGLE_CHOICE question with more than one correct option", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "SINGLE_CHOICE",
        options: [
          { text: "Novorapid", isCorrect: true },
          { text: "Lantus", isCorrect: true },
        ],
      }),
    ).toThrow();
  });

  it("requires TRUE_FALSE to have exactly two options", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "TRUE_FALSE",
        options: [{ text: "True", isCorrect: true }],
      }),
    ).toThrow();
  });

  it("rejects a MATCHING question missing matchText on an option", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "MATCHING",
        options: [
          { text: "Insulin R", matchText: "Yellow label" },
          { text: "Insulin N" }, // missing matchText
        ],
      }),
    ).toThrow();
  });

  it("accepts a MATCHING question where every option has matchText", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "MATCHING",
        options: [
          { text: "Insulin R", matchText: "Yellow label" },
          { text: "Insulin N", matchText: "Green label" },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects an ORDERING question whose correctPosition is not a clean permutation", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "ORDERING",
        options: [
          { text: "Step 1", correctPosition: 1 },
          { text: "Step 2", correctPosition: 1 }, // duplicate position
          { text: "Step 3", correctPosition: 3 },
        ],
      }),
    ).toThrow();
  });

  it("accepts an ORDERING question with a valid 1..n permutation", () => {
    expect(() =>
      quizQuestionSchema.parse({
        ...baseQuestion,
        type: "ORDERING",
        options: [
          { text: "Step 1", correctPosition: 1 },
          { text: "Step 2", correctPosition: 2 },
          { text: "Step 3", correctPosition: 3 },
        ],
      }),
    ).not.toThrow();
  });
});

describe("createQuizSchema", () => {
  it("requires at least one question", () => {
    expect(() =>
      createQuizSchema.parse({
        slug: "insulin-basics-quiz",
        title: "Insulin Basics Quiz",
        questions: [],
      }),
    ).toThrow();
  });
});

describe("syncPushSchema", () => {
  const validEvent = {
    clientId: "b3b1c2e4-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    type: "TOPIC_COMPLETION" as const,
    occurredAt: new Date().toISOString(),
    payload: { topicSlug: "insulin-basics", locale: "EN" as const, secondsSpent: 120 },
  };

  it("accepts a well-formed single-event batch", () => {
    expect(() =>
      syncPushSchema.parse({ sentAt: new Date().toISOString(), events: [validEvent] }),
    ).not.toThrow();
  });

  it("rejects a batch over the maximum size", () => {
    const events = Array.from({ length: MAX_SYNC_BATCH + 1 }, (_, i) => ({
      ...validEvent,
      clientId: `${validEvent.clientId.slice(0, -2)}${String(i).padStart(2, "0")}`,
    }));
    expect(() => syncPushSchema.parse({ sentAt: new Date().toISOString(), events })).toThrow();
  });

  it("rejects an event whose clientId is not a UUID", () => {
    expect(() =>
      syncPushSchema.parse({
        sentAt: new Date().toISOString(),
        events: [{ ...validEvent, clientId: "not-a-uuid" }],
      }),
    ).toThrow();
  });

  it("requires at least one response on a QUIZ_ATTEMPT event", () => {
    expect(() =>
      syncPushSchema.parse({
        sentAt: new Date().toISOString(),
        events: [
          {
            clientId: validEvent.clientId,
            type: "QUIZ_ATTEMPT",
            occurredAt: new Date().toISOString(),
            payload: {
              quizSlug: "insulin-basics-quiz",
              locale: "EN",
              startedAt: new Date().toISOString(),
              responses: [],
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts each of the three answer shapes on a quiz response", () => {
    const shapes = [
      { optionId: "opt1" },
      { pairs: [{ optionId: "opt1", matchOptionId: "opt1" }] },
      { order: ["opt1", "opt2"] },
    ];

    for (const answer of shapes) {
      expect(() =>
        syncPushSchema.parse({
          sentAt: new Date().toISOString(),
          events: [
            {
              clientId: validEvent.clientId,
              type: "QUIZ_ATTEMPT",
              occurredAt: new Date().toISOString(),
              payload: {
                quizSlug: "insulin-basics-quiz",
                locale: "EN",
                startedAt: new Date().toISOString(),
                responses: [{ questionKey: "q1", answer, answeredAt: new Date().toISOString() }],
              },
            },
          ],
        }),
      ).not.toThrow();
    }
  });
});

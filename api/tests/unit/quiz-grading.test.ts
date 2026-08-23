import { describe, expect, it } from "vitest";

import { gradeAttempt, gradeQuestion, type GradableQuestion } from "@/lib/quizzes/grading";

describe("gradeQuestion — SINGLE_CHOICE / TRUE_FALSE", () => {
  const question: GradableQuestion = {
    id: "q1",
    type: "SINGLE_CHOICE",
    points: 2,
    options: [
      { id: "a", isCorrect: false, correctPosition: null },
      { id: "b", isCorrect: true, correctPosition: null },
      { id: "c", isCorrect: false, correctPosition: null },
    ],
  };

  it("awards full points for the correct option", () => {
    expect(gradeQuestion(question, { optionId: "b" })).toEqual({
      isCorrect: true,
      pointsAwarded: 2,
    });
  });

  it("awards zero for an incorrect option", () => {
    expect(gradeQuestion(question, { optionId: "a" })).toEqual({
      isCorrect: false,
      pointsAwarded: 0,
    });
  });

  it("awards zero for an unknown option id", () => {
    expect(gradeQuestion(question, { optionId: "does-not-exist" })).toEqual({
      isCorrect: false,
      pointsAwarded: 0,
    });
  });

  it("ignores a mismatched answer shape rather than throwing", () => {
    expect(gradeQuestion(question, { order: ["a", "b"] })).toEqual({
      isCorrect: false,
      pointsAwarded: 0,
    });
  });
});

describe("gradeQuestion — MATCHING (partial credit)", () => {
  const question: GradableQuestion = {
    id: "q2",
    type: "MATCHING",
    points: 4,
    options: [
      { id: "insulin-r", isCorrect: false, correctPosition: null },
      { id: "insulin-n", isCorrect: false, correctPosition: null },
      { id: "lantus", isCorrect: false, correctPosition: null },
      { id: "novorapid", isCorrect: false, correctPosition: null },
    ],
  };

  it("is fully correct when every pair matches itself", () => {
    const result = gradeQuestion(question, {
      pairs: [
        { optionId: "insulin-r", matchOptionId: "insulin-r" },
        { optionId: "insulin-n", matchOptionId: "insulin-n" },
        { optionId: "lantus", matchOptionId: "lantus" },
        { optionId: "novorapid", matchOptionId: "novorapid" },
      ],
    });
    expect(result).toEqual({ isCorrect: true, pointsAwarded: 4 });
  });

  it("awards proportional partial credit for some correct pairs", () => {
    const result = gradeQuestion(question, {
      pairs: [
        { optionId: "insulin-r", matchOptionId: "insulin-r" },
        { optionId: "insulin-n", matchOptionId: "lantus" },
        { optionId: "lantus", matchOptionId: "insulin-n" },
        { optionId: "novorapid", matchOptionId: "novorapid" },
      ],
    });
    expect(result.isCorrect).toBe(false);
    // 2 of 4 pairs correct: floor(4 * 2/4) = 2
    expect(result.pointsAwarded).toBe(2);
  });

  it("awards zero for an empty submission", () => {
    expect(gradeQuestion(question, { pairs: [] })).toEqual({
      isCorrect: false,
      pointsAwarded: 0,
    });
  });
});

describe("gradeQuestion — ORDERING (sequencing)", () => {
  const question: GradableQuestion = {
    id: "q3",
    type: "ORDERING",
    points: 3,
    options: [
      { id: "step1", isCorrect: false, correctPosition: 1 },
      { id: "step2", isCorrect: false, correctPosition: 2 },
      { id: "step3", isCorrect: false, correctPosition: 3 },
    ],
  };

  it("is fully correct for the right sequence", () => {
    expect(gradeQuestion(question, { order: ["step1", "step2", "step3"] })).toEqual({
      isCorrect: true,
      pointsAwarded: 3,
    });
  });

  it("awards partial credit for a partially correct sequence", () => {
    // step1 in position 1 (correct), step3/step2 swapped (both wrong)
    const result = gradeQuestion(question, { order: ["step1", "step3", "step2"] });
    expect(result.isCorrect).toBe(false);
    expect(result.pointsAwarded).toBe(1); // floor(3 * 1/3) = 1
  });

  it("rejects a submission with the wrong number of steps", () => {
    expect(gradeQuestion(question, { order: ["step1", "step2"] })).toEqual({
      isCorrect: false,
      pointsAwarded: 0,
    });
  });
});

describe("gradeAttempt", () => {
  const questions: GradableQuestion[] = [
    {
      id: "q1",
      type: "TRUE_FALSE",
      points: 1,
      options: [
        { id: "true", isCorrect: true, correctPosition: null },
        { id: "false", isCorrect: false, correctPosition: null },
      ],
    },
    {
      id: "q2",
      type: "TRUE_FALSE",
      points: 1,
      options: [
        { id: "true", isCorrect: false, correctPosition: null },
        { id: "false", isCorrect: true, correctPosition: null },
      ],
    },
  ];

  it("computes overall score and pass/fail against a passing threshold", () => {
    const result = gradeAttempt(
      questions,
      [
        { questionId: "q1", answer: { optionId: "true" } },
        { questionId: "q2", answer: { optionId: "true" } }, // wrong
      ],
      70,
    );
    expect(result.pointsAwarded).toBe(1);
    expect(result.pointsPossible).toBe(2);
    expect(result.scorePercent).toBe(50);
    expect(result.passed).toBe(false);
  });

  it("treats a null passingScore as ungraded pass/fail", () => {
    const result = gradeAttempt(
      questions,
      [
        { questionId: "q1", answer: { optionId: "true" } },
        { questionId: "q2", answer: { optionId: "false" } },
      ],
      null,
    );
    expect(result.scorePercent).toBe(100);
    expect(result.passed).toBeNull();
  });

  it("treats a missing response as incorrect rather than throwing", () => {
    const result = gradeAttempt(questions, [{ questionId: "q1", answer: { optionId: "true" } }], 70);
    expect(result.pointsAwarded).toBe(1);
    expect(result.pointsPossible).toBe(2);
    expect(result.graded).toHaveLength(2);
    expect(result.graded[1]).toEqual({ questionId: "q2", isCorrect: false, pointsAwarded: 0 });
  });
});

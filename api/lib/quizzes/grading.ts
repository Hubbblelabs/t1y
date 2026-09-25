/**
 * Pure quiz grading — deliberately has no `server-only` import and touches no
 * database, so it's unit-testable without a running Postgres and is safe to
 * mirror in the Flutter client for instant local feedback. The server-side
 * call is still the one that's trusted: grading happens again at sync time
 * from the raw `answer`, and a client-supplied verdict is never persisted.
 *
 * Answer shapes, by question type:
 *   SINGLE_CHOICE / TRUE_FALSE -> { optionId: string }
 *   MATCHING  -> { pairs: { optionId: string; matchOptionId: string }[] }
 *   ORDERING  -> { order: string[] }   // optionIds in the participant's order
 *
 * MATCHING options are stored one row per correct pair (`text` = left item,
 * `matchText` = its correct right-hand item). The client shows the left
 * items by their option id and a shuffled column of `matchText` values,
 * each still tagged with the id of the option it belongs to. A pair is
 * correct exactly when `optionId === matchOptionId` — the participant
 * dropped the right-hand text back onto the option it actually came from.
 */

export type QuizQuestionType = "SINGLE_CHOICE" | "TRUE_FALSE" | "MATCHING" | "ORDERING";

export interface GradableOption {
  id: string;
  isCorrect: boolean;
  correctPosition: number | null;
}

export interface GradableQuestion {
  id: string;
  type: QuizQuestionType;
  points: number;
  options: GradableOption[];
}

export type QuestionAnswer =
  | { optionId: string }
  | { pairs: { optionId: string; matchOptionId: string }[] }
  | { order: string[] };

export interface GradeResult {
  isCorrect: boolean;
  pointsAwarded: number;
}

function gradeSingleChoice(question: GradableQuestion, answer: QuestionAnswer): GradeResult {
  if (!("optionId" in answer)) return { isCorrect: false, pointsAwarded: 0 };
  const chosen = question.options.find((o) => o.id === answer.optionId);
  const isCorrect = chosen?.isCorrect === true;
  return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
}

function gradeMatching(question: GradableQuestion, answer: QuestionAnswer): GradeResult {
  if (!("pairs" in answer)) return { isCorrect: false, pointsAwarded: 0 };

  const total = question.options.length;
  if (total === 0) return { isCorrect: false, pointsAwarded: 0 };

  const submitted = new Map(answer.pairs.map((p) => [p.optionId, p.matchOptionId]));
  let correctCount = 0;
  for (const option of question.options) {
    if (submitted.get(option.id) === option.id) correctCount += 1;
  }

  const isCorrect = correctCount === total && answer.pairs.length === total;
  const pointsAwarded = Math.floor((question.points * correctCount) / total);
  return { isCorrect, pointsAwarded };
}

function gradeOrdering(question: GradableQuestion, answer: QuestionAnswer): GradeResult {
  if (!("order" in answer)) return { isCorrect: false, pointsAwarded: 0 };

  const total = question.options.length;
  if (total === 0 || answer.order.length !== total) {
    return { isCorrect: false, pointsAwarded: 0 };
  }

  const correctPositionByOption = new Map(
    question.options.map((o) => [o.id, o.correctPosition]),
  );

  let correctCount = 0;
  answer.order.forEach((optionId, index) => {
    if (correctPositionByOption.get(optionId) === index + 1) correctCount += 1;
  });

  const isCorrect = correctCount === total;
  const pointsAwarded = Math.floor((question.points * correctCount) / total);
  return { isCorrect, pointsAwarded };
}

export function gradeQuestion(question: GradableQuestion, answer: QuestionAnswer): GradeResult {
  switch (question.type) {
    case "SINGLE_CHOICE":
    case "TRUE_FALSE":
      return gradeSingleChoice(question, answer);
    case "MATCHING":
      return gradeMatching(question, answer);
    case "ORDERING":
      return gradeOrdering(question, answer);
  }
}

export interface AttemptGradeResult {
  pointsAwarded: number;
  pointsPossible: number;
  scorePercent: number;
  passed: boolean | null;
  graded: (GradeResult & { questionId: string })[];
}

export function gradeAttempt(
  questions: GradableQuestion[],
  responses: { questionId: string; answer: QuestionAnswer }[],
  passingScore: number | null,
): AttemptGradeResult {
  const responseByQuestion = new Map(responses.map((r) => [r.questionId, r.answer]));

  const graded = questions.map((question) => {
    const answer = responseByQuestion.get(question.id);
    const result = answer
      ? gradeQuestion(question, answer)
      : { isCorrect: false, pointsAwarded: 0 };
    return { questionId: question.id, ...result };
  });

  const pointsPossible = questions.reduce((sum, q) => sum + q.points, 0);
  const pointsAwarded = graded.reduce((sum, g) => sum + g.pointsAwarded, 0);
  const scorePercent =
    pointsPossible > 0 ? Math.round((pointsAwarded / pointsPossible) * 100) : 0;
  const passed = passingScore === null ? null : scorePercent >= passingScore;

  return { pointsAwarded, pointsPossible, scorePercent, passed, graded };
}

/**
 * What a participant can be enrolled for — the client-safe half of
 * lib/services/participant-features.ts (which adds the server-only
 * enforcement on top of this same registry). Split out so the admin form
 * that lets a coordinator choose a child's features can import the keys and
 * labels without pulling in Prisma.
 */
export const PARTICIPANT_FEATURE_KEYS = [
  "GLUCOSE_LOGGING",
  "INSULIN_LOGGING",
  "CARB_LOGGING",
  "HELP_BOOK",
  "QUIZZES",
  "HELP_SUPPORT",
] as const;

export type ParticipantFeatureKey = (typeof PARTICIPANT_FEATURE_KEYS)[number];

export const ALL_PARTICIPANT_FEATURES: ParticipantFeatureKey[] = [...PARTICIPANT_FEATURE_KEYS];

export const PARTICIPANT_FEATURE_LABELS: Record<ParticipantFeatureKey, string> = {
  GLUCOSE_LOGGING: "Glucose readings",
  INSULIN_LOGGING: "Insulin doses",
  CARB_LOGGING: "Carbohydrates eaten",
  HELP_BOOK: "Help Book",
  QUIZZES: "Quizzes",
  HELP_SUPPORT: "Help and support messages",
};

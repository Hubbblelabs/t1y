/// Which app features this account is enrolled for.
///
/// Set by a study coordinator when the participant is created (or changed
/// later from their record) — see the admin dashboard's Participants ›
/// "Which features this family can use". Mirrors
/// api/lib/participant-feature-registry.ts; keep the two in step.
const kGlucoseLogging = 'GLUCOSE_LOGGING';
const kInsulinLogging = 'INSULIN_LOGGING';
const kCarbLogging = 'CARB_LOGGING';
const kHelpBook = 'HELP_BOOK';
const kQuizzes = 'QUIZZES';
const kHelpSupport = 'HELP_SUPPORT';

const kAllParticipantFeatures = {
  kGlucoseLogging,
  kInsulinLogging,
  kCarbLogging,
  kHelpBook,
  kQuizzes,
  kHelpSupport,
};

/// Reads `profile.enabledFeatures` out of a `/api/users/me` response.
///
/// Every feature is treated as on when the field is missing — an older
/// cached copy of `me`, saved before this existed, must not suddenly hide
/// screens a family could use a moment ago.
Set<String> enabledFeaturesFrom(Map<String, dynamic>? me) {
  final profile = me?['profile'] as Map<String, dynamic>?;
  final raw = profile?['enabledFeatures'];
  if (raw is! List) return kAllParticipantFeatures;
  return raw.whereType<String>().toSet();
}

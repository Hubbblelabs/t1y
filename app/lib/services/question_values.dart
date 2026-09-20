import '../l10n/strings.dart';
import '../models/question.dart';

/// Reading a stored answer off a profile, and showing it.
///
/// A built-in question's answer lives in a real profile column under its own
/// key (`heightCm`); an added question's lives in the free-form
/// `customFieldValues` bucket. Both the edit screen and the details screen
/// need to find and word an answer the same way, so they share this rather than
/// each carrying a copy that could drift.

/// The raw stored answer to [question], or null if there is none.
Object? answerFor(Question question, Map<String, dynamic> profile) {
  if (question.builtIn) return profile[question.key];
  final custom = profile['customFieldValues'];
  return custom is Map ? custom[question.key] : null;
}

/// `dd-mm-yyyy`, the way dates are written throughout the app.
String formatDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}';

/// A stored answer in words a parent would read, or null when there is nothing
/// to show (which the caller renders as "Not provided").
String? displayFor(Question question, Object? raw, String locale) {
  if (raw == null) return null;

  switch (question.fieldType) {
    case 'DATE':
      final date = raw is String ? DateTime.tryParse(raw) : null;
      return date == null ? null : formatDate(date);

    case 'CHOICE':
      final value = raw.toString();
      for (final option in question.options) {
        if (option.value == value) return option.label(locale);
      }
      // Records made before "prefer not to say" was withdrawn as a choice still
      // carry it; it is shown, not offered.
      if (value == 'PREFER_NOT_TO_SAY') return S.notStated;
      return null;

    case 'NUMBER':
      if (raw is! num) return null;
      final text = raw == raw.roundToDouble()
          ? raw.toStringAsFixed(0)
          : raw.toString();
      return question.unit == null ? text : '$text ${question.unit}';

    default:
      final text = raw.toString().trim();
      return text.isEmpty ? null : text;
  }
}

/// A section heading in the language the parent is using.
///
/// Sections are named in the dashboard, in English, and carry no translation of
/// their own. The ones the app has always had are mapped back to their existing
/// Tamil wording so nobody loses it; a section an admin invents is shown as
/// written.
String sectionTitle(String section) => switch (section) {
  'About the child' => S.yourDetails,
  'Contact' => S.contact,
  'Treatment' => S.treatmentModality,
  'Measurements' => S.healthDetails,
  'Emergency contact' => S.emergencyContact,
  _ => section,
};

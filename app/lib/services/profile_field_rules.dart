/// The checks a profile question's answer must pass.
///
/// The Dart twin of `api/lib/services/profile-field-rules.ts`. The dashboard
/// describes these rules to whoever sets them and the server enforces them on
/// every added question; this applies the same rules on the phone, so a parent
/// is told about a slip as they type it rather than after a failed save. The
/// wording of every message matches the server's, and both test suites assert
/// the same cases, so the two cannot drift apart unnoticed.
library;

import '../models/question.dart';
import '../l10n/strings.dart';
import '../providers/app_state.dart';

/// Whole years between a birth date and [now].
int ageInYears(DateTime born, [DateTime? now]) {
  final today = now ?? DateTime.now();
  var years = today.year - born.year;
  final hadBirthday =
      today.month > born.month ||
      (today.month == born.month && today.day >= born.day);
  if (!hadBirthday) years -= 1;
  return years;
}

/// Letters (English and Tamil), spaces, hyphens and apostrophes.
final _lettersOnly = RegExp(r"^[A-Za-z஀-௿\s\-']+$");

/// Checks one answer against its question's rules.
///
/// Returns the message to show the parent, or `null` when the answer is fine.
/// [answers] holds the other answers on the same form, which is what lets a
/// year be checked against a date given earlier (a diagnosis cannot come
/// before the birth). [value] is a `String` for text and dates (ISO-8601), a
/// `num` for numbers.
String? checkAnswer(
  Question question,
  Object? value, {
  Map<String, Object?> answers = const {},
  DateTime? now,
}) {
  final label = question.label(AppState.instance.locale);
  final rules = question.rules;
  final today = now ?? DateTime.now();

  switch (question.fieldType) {
    case 'TEXT':
      if (value is! String) return S.mustBeText(label);
      final text = value.trim();
      final minLength = rules.intOrNull('minLength');
      final maxLength = rules.intOrNull('maxLength');
      if (minLength != null && text.length < minLength) {
        return S.needsAtLeastChars(label, minLength);
      }
      if (maxLength != null && text.length > maxLength) {
        return S.keepUnder(label, maxLength);
      }
      if (rules['format'] == 'LETTERS' && !_lettersOnly.hasMatch(text)) {
        return S.lettersOnly(label);
      }
      return null;

    case 'NUMBER':
      if (value is! num || !value.isFinite) return S.mustBeNumber(label);
      if (rules['wholeNumber'] == true && value != value.roundToDouble()) {
        return S.mustBeWhole(label);
      }
      final min = rules.numOrNull('min');
      final max = rules.numOrNull('max');
      if (min != null && value < min) {
        return S.cannotBeLess(label, _plain(min));
      }
      if (max != null && value > max) {
        return S.cannotBeMore(label, _plain(max));
      }
      if (rules['upToCurrentYear'] == true && value > today.year) {
        return S.cannotBeLaterThan(label, today.year);
      }
      final notBefore = rules['notBeforeYearOf'];
      if (notBefore is String) {
        final other = answers[notBefore];
        final otherYear = other is String
            ? DateTime.tryParse(other)?.year
            : null;
        if (otherYear != null && value < otherYear) {
          return S.cannotBeEarlierThan(label, otherYear);
        }
      }
      return null;

    case 'DATE':
      final date = value is String ? DateTime.tryParse(value) : null;
      if (date == null) return S.mustBeValidDate(label);
      if (rules['notInFuture'] == true && date.isAfter(today)) {
        return S.cannotBeFuture(label);
      }
      final age = ageInYears(date, today);
      final minAge = rules.intOrNull('minAgeYears');
      final maxAge = rules.intOrNull('maxAgeYears');
      if (minAge != null && age < minAge) {
        return S.dateTooRecent(label);
      }
      if (maxAge != null && age > maxAge) {
        return S.dateTooOld(label);
      }
      return null;

    default:
      // CHOICE is checked against its options by the caller.
      return null;
  }
}

/// Whole numbers read better without a trailing ".0".
String _plain(num value) =>
    value == value.roundToDouble() ? value.toStringAsFixed(0) : '$value';

extension _RuleReads on Map<String, Object?> {
  int? intOrNull(String key) {
    final v = this[key];
    return v is num ? v.toInt() : null;
  }

  num? numOrNull(String key) {
    final v = this[key];
    return v is num ? v : null;
  }
}

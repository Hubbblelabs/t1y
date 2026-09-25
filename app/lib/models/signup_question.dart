import '../services/profile_field_rules.dart';
import 'question.dart';
import '../l10n/strings.dart';

/// Validates one raw answer typed or chosen in the sign-up chat.
///
/// Returns a message to show the parent, or `null` when the answer is fine.
/// Kept apart from the widget so it can be tested without pumping a widget
/// tree.
///
/// The rules themselves come from the question — the dashboard decides what a
/// good answer is — and are applied by [checkAnswer], the same checks the
/// server runs. [priorAnswers] carries the answers already given earlier in the
/// chat, keyed by question key, which is what lets a diagnosis year be checked
/// against the date of birth.
String? validateSignupAnswer(
  Question question,
  String rawValue, {
  Map<String, String> priorAnswers = const {},
}) {
  final value = rawValue.trim();
  if (value.isEmpty) {
    // An optional question may be left unanswered; a required one may not.
    return question.required ? S.answerRequired : null;
  }

  switch (question.fieldType) {
    case 'CHOICE':
      return question.options.any((o) => o.value == value)
          ? null
          : S.chooseOption;

    case 'NUMBER':
      final number = num.tryParse(value);
      if (number == null) {
        return question.rules['upToCurrentYear'] == true
            ? S.validYear(DateTime.now().year)
            : S.validNumber;
      }
      return checkAnswer(question, number, answers: {...priorAnswers});

    case 'DATE':
      if (DateTime.tryParse(value) == null) return S.validDate;
      return checkAnswer(question, value, answers: {...priorAnswers});

    default:
      return checkAnswer(question, value, answers: {...priorAnswers});
  }
}

/// The Tamil wording of a stored pick-one answer, or null when there is none.
String? displayAnswerTa(Question question, String stored) {
  if (question.fieldType != 'CHOICE') return null;
  for (final option in question.options) {
    if (option.value == stored) return option.labelTa;
  }
  return null;
}

/// What to show in the chat bubble for a stored answer — the wording of the
/// chosen option rather than the value that gets stored.
String displayAnswer(Question question, String stored, String locale) {
  if (question.fieldType == 'CHOICE') {
    for (final option in question.options) {
      if (option.value == stored) return option.label(locale);
    }
  }
  return stored;
}

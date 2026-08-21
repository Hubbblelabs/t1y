enum SignupAnswerType { text, date, choice, year }

/// One step of the chat-style sign-up flow. Fields chosen to match
/// `Profile` on the backend (see `api/prisma/schema.prisma`) — first/last
/// name, date of birth, sex, diagnosis year — kept to the minimum the app
/// actually uses rather than the full profile form.
class SignupQuestion {
  final String key;
  final String prompt;
  final SignupAnswerType type;
  final List<String>? choices;

  const SignupQuestion({
    required this.key,
    required this.prompt,
    required this.type,
    this.choices,
  });
}

const List<SignupQuestion> signupQuestions = [
  SignupQuestion(
    key: 'firstName',
    prompt: "What is the child's first name?",
    type: SignupAnswerType.text,
  ),
  SignupQuestion(
    key: 'lastName',
    prompt: "And their last name?",
    type: SignupAnswerType.text,
  ),
  SignupQuestion(
    key: 'dateOfBirth',
    prompt: "What is their date of birth?",
    type: SignupAnswerType.date,
  ),
  SignupQuestion(
    key: 'sex',
    prompt: "Sex, for the medical record?",
    type: SignupAnswerType.choice,
    choices: ['Female', 'Male', 'Prefer not to say'],
  ),
  SignupQuestion(
    key: 'diagnosisYear',
    prompt: "What year were they diagnosed with Type 1 diabetes?",
    type: SignupAnswerType.year,
  ),
];

/// Validates one raw answer for a question. Returns an error string, or null
/// if valid — kept separate from the widget so it's testable without pumping
/// a widget tree.
String? validateSignupAnswer(SignupQuestion question, String rawValue) {
  final value = rawValue.trim();
  if (value.isEmpty) return 'This is required.';

  switch (question.type) {
    case SignupAnswerType.text:
      if (value.length < 2) return 'Enter at least 2 characters.';
      if (value.length > 80) return 'Keep it under 80 characters.';
      if (!RegExp(r"^[a-zA-Z஀-௿\s\-']+$").hasMatch(value)) {
        return 'Letters only, please.';
      }
      return null;

    case SignupAnswerType.date:
      final date = DateTime.tryParse(value);
      if (date == null) return 'Enter a valid date.';
      final now = DateTime.now();
      final age = now.year - date.year - (now.isBefore(DateTime(now.year, date.month, date.day)) ? 1 : 0);
      if (date.isAfter(now)) return 'Date of birth cannot be in the future.';
      if (age < 0 || age > 25) return 'Enter a date of birth between 0 and 25 years ago.';
      return null;

    case SignupAnswerType.choice:
      if (!(question.choices ?? []).contains(value)) return 'Choose one of the options.';
      return null;

    case SignupAnswerType.year:
      final year = int.tryParse(value);
      final currentYear = DateTime.now().year;
      if (year == null) return 'Enter a valid year, e.g. $currentYear.';
      if (year < 1900 || year > currentYear) return 'Enter a year between 1900 and $currentYear.';
      return null;
  }
}

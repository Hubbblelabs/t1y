/// One choice of a pick-one question.
class QuestionOption {
  /// What is stored — the database's own value ("FEMALE", "INSULIN"), never the
  /// wording, so changing the wording later cannot orphan an answer.
  final String value;
  final String labelEn;
  final String? labelTa;

  const QuestionOption({
    required this.value,
    required this.labelEn,
    this.labelTa,
  });

  String label(String locale) =>
      locale == 'ta' && (labelTa?.trim().isNotEmpty ?? false)
      ? labelTa!
      : labelEn;

  factory QuestionOption.fromJson(Map<String, dynamic> json) => QuestionOption(
    value: json['value'] as String,
    labelEn: json['labelEn'] as String,
    labelTa: json['labelTa'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'value': value,
    'labelEn': labelEn,
    if (labelTa != null) 'labelTa': labelTa,
  };
}

/// A question a parent is asked about their child — in the sign-up chat, on the
/// profile screen, or both.
///
/// Mirrors `AppQuestion` in `api/lib/services/profile-fields.ts`. The app used
/// to carry two hardcoded lists of these (the four sign-up questions and the
/// thirteen on the profile screen); both now come from one list the dashboard
/// controls, with a bundled copy in `config/default_questions.dart` so nothing
/// depends on the server being reachable.
class Question {
  final String key;

  /// `TEXT`, `NUMBER`, `DATE` or `CHOICE`.
  final String fieldType;
  final String section;
  final bool required;
  final int sortOrder;
  final String labelEn;
  final String? labelTa;
  final String? hintEn;
  final String? hintTa;

  /// The sentence the sign-up chat asks. Falls back to the label.
  final String? promptEn;
  final String? promptTa;
  final List<QuestionOption> options;
  final String? unit;

  /// True when the answer lives in a real profile column (name, phone,
  /// height…) rather than in the free-form bucket for added questions.
  final bool builtIn;
  final bool showOnSignup;

  /// The checks an answer must pass; see `services/profile_field_rules.dart`.
  final Map<String, Object?> rules;

  const Question({
    required this.key,
    required this.fieldType,
    required this.labelEn,
    this.section = 'Additional details',
    this.required = false,
    this.sortOrder = 0,
    this.labelTa,
    this.hintEn,
    this.hintTa,
    this.promptEn,
    this.promptTa,
    this.options = const [],
    this.unit,
    this.builtIn = false,
    this.showOnSignup = false,
    this.rules = const {},
  });

  String label(String locale) =>
      locale == 'ta' && (labelTa?.trim().isNotEmpty ?? false)
      ? labelTa!
      : labelEn;

  /// The question as the sign-up chat words it, falling back to the label so a
  /// question added without a sentence still reads sensibly.
  String prompt(String locale) {
    if (locale == 'ta' && (promptTa?.trim().isNotEmpty ?? false)) {
      return promptTa!;
    }
    if (promptEn?.trim().isNotEmpty ?? false) return promptEn!;
    return label(locale);
  }

  /// The sign-up sentence in English, falling back to the label.
  String get promptEnglish =>
      (promptEn?.trim().isNotEmpty ?? false) ? promptEn! : labelEn;

  /// Its Tamil translation, or null when there is none. Deliberately not
  /// falling back to the Tamil *label*: a label is a noun, not the sentence
  /// being asked, and showing it as the translation would be wrong.
  String? get promptTamil =>
      (promptTa?.trim().isNotEmpty ?? false) ? promptTa : null;

  String? hint(String locale) =>
      locale == 'ta' && (hintTa?.trim().isNotEmpty ?? false) ? hintTa : hintEn;

  factory Question.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'] as List<dynamic>?;
    final rawRules = json['rules'];
    return Question(
      key: json['key'] as String,
      fieldType: json['fieldType'] as String,
      section: json['section'] as String? ?? 'Additional details',
      required: json['required'] as bool? ?? false,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      labelEn: json['labelEn'] as String,
      labelTa: json['labelTa'] as String?,
      hintEn: json['hintEn'] as String?,
      hintTa: json['hintTa'] as String?,
      promptEn: json['promptEn'] as String?,
      promptTa: json['promptTa'] as String?,
      options: rawOptions == null
          ? const []
          : rawOptions
                .map((o) => QuestionOption.fromJson(o as Map<String, dynamic>))
                .toList(),
      unit: json['unit'] as String?,
      builtIn: json['builtIn'] as bool? ?? false,
      showOnSignup: json['showOnSignup'] as bool? ?? false,
      rules: rawRules is Map ? Map<String, Object?>.from(rawRules) : const {},
    );
  }

  Map<String, dynamic> toJson() => {
    'key': key,
    'fieldType': fieldType,
    'section': section,
    'required': required,
    'sortOrder': sortOrder,
    'labelEn': labelEn,
    if (labelTa != null) 'labelTa': labelTa,
    if (hintEn != null) 'hintEn': hintEn,
    if (hintTa != null) 'hintTa': hintTa,
    if (promptEn != null) 'promptEn': promptEn,
    if (promptTa != null) 'promptTa': promptTa,
    if (options.isNotEmpty) 'options': options.map((o) => o.toJson()).toList(),
    if (unit != null) 'unit': unit,
    'builtIn': builtIn,
    'showOnSignup': showOnSignup,
    if (rules.isNotEmpty) 'rules': rules,
  };
}

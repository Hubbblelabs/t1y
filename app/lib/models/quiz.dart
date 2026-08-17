class QuizOption {
  final String id;
  final int position;
  final String text;
  final String? matchText;

  QuizOption({required this.id, required this.position, required this.text, this.matchText});

  factory QuizOption.fromJson(Map<String, dynamic> json) => QuizOption(
        id: json['id'] as String,
        position: json['position'] as int,
        text: json['text'] as String,
        matchText: json['matchText'] as String?,
      );
}

/// Mirrors api/lib/quizzes/grading.ts's QuizQuestionType.
enum QuestionType { singleChoice, trueFalse, matching, ordering }

QuestionType questionTypeFromString(String value) {
  switch (value) {
    case 'SINGLE_CHOICE':
      return QuestionType.singleChoice;
    case 'TRUE_FALSE':
      return QuestionType.trueFalse;
    case 'MATCHING':
      return QuestionType.matching;
    case 'ORDERING':
      return QuestionType.ordering;
  }
  throw ArgumentError('Unknown question type: $value');
}

class QuizQuestion {
  final String id;
  final QuestionType type;
  final String questionKey;
  final String prompt;
  final String? explanation;
  final int points;
  final List<QuizOption> options;

  QuizQuestion({
    required this.id,
    required this.type,
    required this.questionKey,
    required this.prompt,
    required this.explanation,
    required this.points,
    required this.options,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) => QuizQuestion(
        id: json['id'] as String,
        type: questionTypeFromString(json['type'] as String),
        questionKey: json['questionKey'] as String,
        prompt: json['prompt'] as String,
        explanation: json['explanation'] as String?,
        points: json['points'] as int,
        options: (json['options'] as List)
            .map((o) => QuizOption.fromJson(o as Map<String, dynamic>))
            .toList(),
      );
}

class Quiz {
  final String id;
  final String slug;
  final String locale;
  final String? topicSlug;
  final String title;
  final String? description;
  final int? passingScore;
  final List<QuizQuestion> questions;

  Quiz({
    required this.id,
    required this.slug,
    required this.locale,
    required this.topicSlug,
    required this.title,
    required this.description,
    required this.passingScore,
    required this.questions,
  });

  factory Quiz.fromJson(Map<String, dynamic> json) => Quiz(
        id: json['id'] as String,
        slug: json['slug'] as String,
        locale: json['locale'] as String,
        topicSlug: json['topicSlug'] as String?,
        title: json['title'] as String,
        description: json['description'] as String?,
        passingScore: json['passingScore'] as int?,
        questions: (json['questions'] as List)
            .map((q) => QuizQuestion.fromJson(q as Map<String, dynamic>))
            .toList(),
      );
}

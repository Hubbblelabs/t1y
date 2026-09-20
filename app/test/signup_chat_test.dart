import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/models/question.dart';
import 'package:t1dpe/screens/auth/signup_chat_screen.dart';

/// The sign-up chat, driven the way a parent would use it.
///
/// There is no server in a widget test, so the questions come from the copy
/// bundled with the app — which is exactly the situation the chat has to
/// handle when a phone has no signal, and the reason that copy exists.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> open(WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: SignupChatScreen(email: 'a@example.test', password: 'unused'),
      ),
    );
    // Let the question list load and the first bubbles animate in.
    await tester.pumpAndSettle(const Duration(seconds: 8));
  }

  Future<void> answer(WidgetTester tester, String text) async {
    await tester.enterText(find.byType(TextField), text);
    await tester.tap(find.byIcon(Icons.arrow_forward));
    await tester.pumpAndSettle();
  }

  testWidgets('asks the first question from the bundled list with no server', (
    tester,
  ) async {
    await open(tester);

    expect(find.text('What is your child name?'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('holds a name to its checks and says how to fix it', (
    tester,
  ) async {
    await open(tester);

    await answer(tester, 'A');
    expect(find.textContaining('at least 2'), findsOneWidget);

    await answer(tester, 'Anbu123');
    expect(find.textContaining('letters only'), findsOneWidget);

    // Still on the first question: neither slip was accepted.
    expect(find.text('What is their date of birth?'), findsNothing);
  });

  testWidgets('moves on once the name is good', (tester) async {
    await open(tester);

    await answer(tester, 'Anbu');

    expect(find.text('What is their date of birth?'), findsOneWidget);
  });

  testWidgets('asks sex with choices, and shows the wording chosen', (
    tester,
  ) async {
    await open(tester);
    await answer(tester, 'Anbu');

    // Skip the date picker by answering through the field it fills in.
    final dobField = tester.widget<TextField>(find.byType(TextField));
    dobField.controller!.text = '2016-04-10';
    await tester.tap(find.byIcon(Icons.arrow_forward));
    await tester.pumpAndSettle();

    expect(find.text('Sex, for the medical record?'), findsOneWidget);
    expect(find.widgetWithText(ActionChip, 'Female'), findsOneWidget);
    expect(find.widgetWithText(ActionChip, 'Male'), findsOneWidget);
    // "Prefer not to say" was withdrawn as a choice.
    expect(find.textContaining('Prefer'), findsNothing);

    await tester.tap(find.widgetWithText(ActionChip, 'Female'));
    await tester.pumpAndSettle();

    // The bubble shows the wording; what is stored is the option's value.
    expect(find.text('Female'), findsOneWidget);
    expect(
      find.text('What year were they diagnosed with Type 1 diabetes?'),
      findsOneWidget,
    );
  });

  testWidgets('refuses a diagnosis year before the birth year', (tester) async {
    await open(tester);
    await answer(tester, 'Anbu');

    final dobField = tester.widget<TextField>(find.byType(TextField));
    dobField.controller!.text = '2018-06-01';
    await tester.tap(find.byIcon(Icons.arrow_forward));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(ActionChip, 'Male'));
    await tester.pumpAndSettle();

    await answer(tester, '2015');
    expect(find.textContaining('cannot be earlier than 2018'), findsOneWidget);
  });

  testWidgets('offers no Skip on a required question', (tester) async {
    await open(tester);
    expect(find.textContaining('Skip'), findsNothing);
  });

  testWidgets('offers Skip on an optional question added in the dashboard', (
    tester,
  ) async {
    // Seed the phone's own copy of the list with an extra optional question, as
    // if the dashboard had added one and the phone had fetched it.
    final extra = [
      const Question(
        key: 'name',
        fieldType: 'TEXT',
        labelEn: "Child's name",
        required: true,
        showOnSignup: true,
        builtIn: true,
        sortOrder: 10,
        promptEn: 'What is your child name?',
      ),
      const Question(
        key: 'dateOfBirth',
        fieldType: 'DATE',
        labelEn: 'Date of birth',
        required: true,
        showOnSignup: true,
        builtIn: true,
        sortOrder: 20,
      ),
      const Question(
        key: 'sex',
        fieldType: 'CHOICE',
        labelEn: 'Sex',
        required: true,
        showOnSignup: true,
        builtIn: true,
        sortOrder: 30,
        options: [QuestionOption(value: 'FEMALE', labelEn: 'Female')],
      ),
      const Question(
        key: 'diagnosisYear',
        fieldType: 'NUMBER',
        labelEn: 'Year of diagnosis',
        required: true,
        showOnSignup: true,
        builtIn: true,
        sortOrder: 40,
      ),
      const Question(
        key: 'school',
        fieldType: 'TEXT',
        labelEn: 'School',
        showOnSignup: true,
        sortOrder: 50,
        promptEn: 'Which school does your child attend?',
      ),
    ];
    SharedPreferences.setMockInitialValues({
      'signup_questions_cache': _encode(extra),
    });

    await open(tester);
    await answer(tester, 'Anbu');
    final dobField = tester.widget<TextField>(find.byType(TextField));
    dobField.controller!.text = '2016-04-10';
    await tester.tap(find.byIcon(Icons.arrow_forward));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ActionChip, 'Female'));
    await tester.pumpAndSettle();
    await answer(tester, '2020');

    expect(find.text('Which school does your child attend?'), findsOneWidget);
    expect(find.textContaining('Skip'), findsOneWidget);

    await tester.tap(find.textContaining('Skip'));
    await tester.pumpAndSettle();

    // Skipped, so the chat moves on to the terms rather than demanding it.
    expect(find.text('Read Terms & Conditions'), findsOneWidget);
  });
}

String _encode(List<Question> questions) {
  // Same shape the service writes to the phone's own copy.
  final buffer = StringBuffer('[');
  for (var i = 0; i < questions.length; i++) {
    if (i > 0) buffer.write(',');
    buffer.write(_json(questions[i].toJson()));
  }
  buffer.write(']');
  return buffer.toString();
}

String _json(Object? value) {
  if (value == null) return 'null';
  if (value is String) return '"${value.replaceAll('"', r'\"')}"';
  if (value is num || value is bool) return '$value';
  if (value is List) return '[${value.map(_json).join(',')}]';
  if (value is Map) {
    return '{${value.entries.map((e) => '"${e.key}":${_json(e.value)}').join(',')}}';
  }
  return '"$value"';
}

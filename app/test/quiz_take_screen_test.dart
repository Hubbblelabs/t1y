import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:t1dpe/models/quiz.dart';
import 'package:t1dpe/screens/quizzes/quiz_take_screen.dart';

Quiz _threeQuestionQuiz() {
  QuizQuestion sc(String key, String prompt) => QuizQuestion(
    id: key,
    type: QuestionType.singleChoice,
    questionKey: key,
    prompt: prompt,
    explanation: null,
    points: 1,
    options: [
      QuizOption(id: '${key}_a', position: 0, text: 'Option A for $key'),
      QuizOption(id: '${key}_b', position: 1, text: 'Option B for $key'),
    ],
  );

  return Quiz(
    id: 'quiz1',
    slug: 'all-in-one-test',
    locale: 'EN',
    topicSlug: null,
    title: 'All-in-one test quiz',
    description: null,
    passingScore: 70,
    questions: [
      sc('q1', 'First question'),
      sc('q2', 'Second question'),
      sc('q3', 'Third question'),
    ],
  );
}

void main() {
  _quizTakeScreenScrollTests();

  testWidgets(
    'every question renders on one page, no Next/Previous/summary card text, '
    'and Submit validates in place instead of staying disabled',
    (tester) async {
      // A tall viewport so every question and the status strip at the bottom
      // are actually built (a real device would scroll to reach them, but
      // Sliver lists don't build far-off-screen children at all).
      tester.view.physicalSize = const Size(500, 3200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(home: QuizTakeScreen(quiz: _threeQuestionQuiz())),
      );
      await tester.pumpAndSettle();

      // All three questions are visible on the same page — nothing paginated.
      expect(find.text('First question'), findsOneWidget);
      expect(find.text('Second question'), findsOneWidget);
      expect(find.text('Third question'), findsOneWidget);

      // No Previous/Next controls, and none of the removed summary-card copy.
      expect(find.text('Previous'), findsNothing);
      expect(find.text('Next'), findsNothing);
      expect(find.text('Question summary'), findsNothing);
      expect(find.text('Review your answers'), findsNothing);
      expect(
        find.text('Answer every question before submitting.'),
        findsNothing,
      );

      // Submit is always tappable — never a disabled button.
      final submitFinder = find.widgetWithText(FilledButton, 'Submit quiz');
      FilledButton submitButton() => tester.widget<FilledButton>(submitFinder);
      expect(submitButton().onPressed, isNotNull);

      // No error banner yet — nothing has been submitted.
      expect(find.text('Please answer this question.'), findsNothing);

      // Nothing answered: pressing Submit must not attempt a real submission
      // (no network call — this test has no server to answer it). Instead it
      // shows a toast and flags all three at once — one press, every gap.
      await tester.tap(submitFinder);
      await tester.pump(); // SnackBar enters on its own animation frame
      expect(find.text('Answer all the questions to submit.'), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.text('Please answer this question.'), findsNWidgets(3));

      // Answer Q2 (out of order — free navigation) and Q3, leaving Q1 open.
      // Answering clears each question's own error immediately, without
      // needing to press Submit again.
      await tester.tap(find.text('Option B for q2'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Option A for q3'));
      await tester.pumpAndSettle();
      expect(find.text('Please answer this question.'), findsOneWidget);

      // Now answer Q1 too. The error clears immediately (before Submit is
      // even pressed again) because the flagged question is now answered.
      await tester.tap(find.text('Option A for q1'));
      await tester.pumpAndSettle();
      expect(find.text('Please answer this question.'), findsNothing);

      // The bottom status strip still has a tile per question, and tapping
      // one scrolls the page to it rather than opening any separate screen.
      await tester.tap(find.text('1').last);
      await tester.pumpAndSettle();
      expect(find.text('First question'), findsOneWidget);
    },
  );
}

Quiz _twelveQuestionQuiz() {
  QuizQuestion sc(String key, String prompt) => QuizQuestion(
    id: key,
    type: QuestionType.singleChoice,
    questionKey: key,
    prompt: prompt,
    explanation: null,
    points: 1,
    options: [
      QuizOption(id: '${key}_a', position: 0, text: 'Yes, $key'),
      QuizOption(id: '${key}_b', position: 1, text: 'No, $key'),
    ],
  );

  return Quiz(
    id: 'quiz2',
    slug: 'scroll-test',
    locale: 'EN',
    topicSlug: null,
    title: 'Scroll test quiz',
    description: null,
    passingScore: 70,
    questions: List.generate(
      12,
      (i) => sc('q${i + 1}', 'Question number ${i + 1}'),
    ),
  );
}

// The outer ListView is the page's own Scrollable; the status grid's
// GridView is also technically one (shrinkWrap + NeverScrollableScrollPhysics
// still creates a Scrollable, it just ignores drags) — `.first` picks the
// outer one, which is what actually moves.
double _scrollOffset(WidgetTester tester) => tester
    .state<ScrollableState>(find.byType(Scrollable).first)
    .position
    .pixels;

void _quizTakeScreenScrollTests() {
  // A real, un-inflated viewport — the earlier test in this file used an
  // artificially tall one specifically so every question was pre-built,
  // which would have hidden a scroll-to-question regression entirely. The
  // Submit button and status grid sit after all 12 questions (by design —
  // "at the last"), so reaching them for the first time genuinely requires
  // scrolling down first, exactly as a real reader would.
  final scrollable = find.byType(Scrollable).first;
  final submitButton = find.widgetWithText(FilledButton, 'Submit quiz');

  testWidgets('tapping a status tile scrolls back up to that question', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: QuizTakeScreen(quiz: _twelveQuestionQuiz())),
    );
    await tester.pumpAndSettle();
    expect(_scrollOffset(tester), 0, reason: 'starts at the top');

    // Scroll down to where the status grid lives, as a reader would after
    // reading through the quiz.
    await tester.dragUntilVisible(
      submitButton,
      scrollable,
      const Offset(0, -300),
    );
    final bottomOffset = _scrollOffset(tester);
    expect(bottomOffset, greaterThan(500));

    // Tile "1" is now on screen next to Submit. Tapping it must scroll all
    // the way back up to Q1 — not just exist in the tree, actually move.
    await tester.tap(find.text('1').last);
    await tester.pumpAndSettle();

    expect(
      _scrollOffset(tester),
      lessThan(bottomOffset - 500),
      reason: 'tapping tile 1 should have scrolled far back up the page',
    );
    expect(
      tester.getTopLeft(find.text('Question number 1')).dy,
      lessThan(200),
      reason: 'Q1 should now be near the top of the viewport',
    );
  });

  testWidgets(
    'a failed Submit marks every unanswered question at once and scrolls to the first',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: QuizTakeScreen(quiz: _twelveQuestionQuiz())),
      );
      await tester.pumpAndSettle();

      // Answer only the first six, scrolling down to each in turn — later
      // ones are not built yet at this viewport height until scrolled near.
      for (var i = 1; i <= 6; i++) {
        final option = find.text('Yes, q$i');
        await tester.dragUntilVisible(
          option,
          scrollable,
          const Offset(0, -250),
        );
        await tester.tap(option);
        await tester.pumpAndSettle();
      }

      // Scroll down to reach Submit, as a reader finishing the quiz would.
      await tester.dragUntilVisible(
        submitButton,
        scrollable,
        const Offset(0, -300),
      );
      final bottomOffset = _scrollOffset(tester);

      await tester.tap(submitButton);
      await tester.pumpAndSettle();

      // Q7 is the first unanswered question, well above where Submit sits —
      // validation must scroll back up to it, not just flag it in place.
      expect(
        _scrollOffset(tester),
        lessThan(bottomOffset - 300),
        reason:
            'a failed Submit should scroll up to the first unanswered question (Q7)',
      );
      // More than one error banner is showing — not just the question the
      // page happened to land on (the exact count across every unanswered
      // question, regardless of what a test drag happens to have scrolled
      // past, is covered separately below with a viewport tall enough that
      // scrolling isn't a factor).
      expect(find.text('Please answer this question.'), findsWidgets);
      expect(
        find.text('Please answer this question.').evaluate().length,
        greaterThan(1),
        reason: 'a quiz left with several gaps should flag more than just one',
      );

      // The error must be sitting on Q7's own card, not merely somewhere
      // on screen — its card and the (first) message should be close.
      final q7Top = tester.getTopLeft(find.text('Question number 7')).dy;
      final errorTop = tester
          .getTopLeft(find.text('Please answer this question.').first)
          .dy;
      expect((errorTop - q7Top).abs(), lessThan(150));
    },
  );

  testWidgets(
    'a failed Submit flags every unanswered question, and each clears on its own',
    (tester) async {
      // A tall viewport so all 12 questions and the status card build at
      // once — isolates the flagging logic itself from the separate (and
      // separately tested, above) question of whether real scrolling works.
      tester.view.physicalSize = const Size(500, 6000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(home: QuizTakeScreen(quiz: _twelveQuestionQuiz())),
      );
      await tester.pumpAndSettle();

      for (var i = 1; i <= 6; i++) {
        await tester.tap(find.text('Yes, q$i'));
      }
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(FilledButton, 'Submit quiz'));
      await tester.pumpAndSettle();

      // All six unanswered questions (Q7-Q12) get the error in this same
      // pass — not just the first. One Submit press should surface every
      // gap, so a second press isn't needed just to discover the next one.
      expect(find.text('Please answer this question.'), findsNWidgets(6));

      // Answering Q7 clears only its own error — the rest (Q8-Q12) remain
      // flagged from that same Submit press, without pressing Submit again.
      await tester.tap(find.text('Yes, q7'));
      await tester.pumpAndSettle();
      expect(find.text('Please answer this question.'), findsNWidgets(5));
    },
  );
}

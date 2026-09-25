import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/screens/quizzes/quiz_list_screen.dart';
import 'package:t1dpe/services/api_client.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
    'tapping "Try again" after a failed load does not crash the app',
    (tester) async {
      // Regression test: `setState(() => _future = _load(...))` returns the
      // assigned Future as the closure's own value, and Flutter treats a
      // setState callback that returns a Future as a fatal error — thrown
      // synchronously, from inside the tap handler, before anything is
      // awaited. The fix is a block body —
      // `setState(() { _future = _load(...); })` — which returns nothing.
      final errors = <FlutterErrorDetails>[];
      final previousOnError = FlutterError.onError;
      FlutterError.onError = errors.add;
      addTearDown(() => FlutterError.onError = previousOnError);

      await tester.pumpWidget(const MaterialApp(home: QuizListScreen()));
      await tester.pump(apiRequestTimeout + const Duration(seconds: 1));
      await tester.pump();

      expect(find.text('Try again'), findsOneWidget);

      // The crash (when present) is thrown synchronously inside setState,
      // during this tap — no need to wait out a second network timeout.
      await tester.tap(find.text('Try again'));
      await tester.pump();

      expect(
        errors,
        isEmpty,
        reason: errors.map((e) => e.exceptionAsString()).join('\n'),
      );
    },
  );
}

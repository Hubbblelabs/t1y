import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/services/glucose_service.dart';
import 'package:t1dpe/widgets/progress_card.dart';

List<DailyGlucose> _days() {
  final today = DateTime.now();
  return [
    for (var i = 9; i >= 0; i--)
      DailyGlucose(
        DateTime(today.year, today.month, today.day - i),
        110.0 + (i % 4) * 25,
        2,
      ),
  ];
}

Widget _app(Widget graph) => MaterialApp(
  home: Scaffold(
    body: ListView(padding: const EdgeInsets.all(20), children: [graph]),
  ),
);

void main() {
  testWidgets('the graph card builds on a phone without overflow', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 780));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_app(GlucoseGraph(days: _days())));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('picking a day elsewhere moves the detail line to that day', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 780));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final days = _days();
    final first = days[2].day;
    await tester.pumpWidget(_app(GlucoseGraph(days: days)));
    await tester.pumpAndSettle();
    // Re-pump with a focus day: the detail line follows it.
    await tester.pumpWidget(_app(GlucoseGraph(days: days, focusDay: first)));
    await tester.pumpAndSettle();
    expect(find.textContaining('${first.day} '), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  test('the graph only appears once a day has passed', () {
    final today = DateTime.now();
    final d = DateTime(today.year, today.month, today.day);
    expect(GlucoseGraph.isReady([DailyGlucose(d, 120, 1)]), isFalse);
    expect(
      GlucoseGraph.isReady([DailyGlucose(d, 120, 1), DailyGlucose(d, 130, 1)]),
      isFalse,
    );
    expect(
      GlucoseGraph.isReady([
        DailyGlucose(d.subtract(const Duration(days: 1)), 120, 1),
        DailyGlucose(d, 130, 1),
      ]),
      isTrue,
    );
  });
}

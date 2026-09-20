import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/models/glucose_reading.dart';
import 'package:t1dpe/screens/home/home_cards.dart';

GlucoseReading reading(double value, DateTime when) => GlucoseReading(
  id: '$value$when',
  value: value,
  context: GlucoseContext.random,
  measuredAt: when,
);

void main() {
  group('daily averages', () {
    test('averages the readings taken on the same day', () {
      final averages = dailyAverages([
        reading(100, DateTime(2026, 9, 20, 8)),
        reading(200, DateTime(2026, 9, 20, 20)),
      ]);
      expect(averages[DateTime(2026, 9, 20)], 150);
    });

    test('keeps different days apart', () {
      final averages = dailyAverages([
        reading(100, DateTime(2026, 9, 19, 23, 59)),
        reading(300, DateTime(2026, 9, 20, 0, 1)),
      ]);
      expect(averages[DateTime(2026, 9, 19)], 100);
      expect(averages[DateTime(2026, 9, 20)], 300);
    });

    /// An empty day is "nothing recorded", never a glucose of zero — a bar of
    /// height zero would read as a dangerously low day.
    test('leaves out a day with no readings rather than calling it zero', () {
      final averages = dailyAverages([reading(120, DateTime(2026, 9, 20, 8))]);
      expect(averages.containsKey(DateTime(2026, 9, 19)), isFalse);
      expect(averages.values.every((v) => v > 0), isTrue);
    });

    test('is empty when there are no readings at all', () {
      expect(dailyAverages(const []), isEmpty);
    });
  });

  group('colours', () {
    test('match the bands the Health tab dial uses', () {
      expect(bandColour(69), const Color(0xFFE53935)); // low
      expect(bandColour(70), const Color(0xFF2E7D32)); // in range
      expect(bandColour(180), const Color(0xFF2E7D32));
      expect(bandColour(181), const Color(0xFFEF6C00)); // high
    });
  });

  group('the week chart', () {
    final days = [for (var i = 0; i < 7; i++) DateTime(2026, 9, 14 + i)];
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    testWidgets('shows a value for a day with readings and none otherwise', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeekTrendCard(
              days: days,
              averages: {days[6]: 155},
              selected: days[6],
              dayLabels: labels,
              onSelect: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('155'), findsOneWidget);
      // One value among seven days: the other six show no number at all.
      expect(find.text('0'), findsNothing);
    });

    testWidgets('selects a day when its bar is tapped', (tester) async {
      DateTime? chosen;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: WeekTrendCard(
              days: days,
              averages: {days[2]: 120},
              selected: days[6],
              dayLabels: labels,
              onSelect: (day) => chosen = day,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('120'));
      expect(chosen, days[2]);
    });
  });

  group('learning progress', () {
    testWidgets('says how far through the curriculum a parent is', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: LearningProgressCard(read: 3, total: 8)),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('3 of 8 topics read'), findsOneWidget);
      expect(find.text('38%'), findsOneWidget);
    });

    testWidgets('congratulates once every topic is read', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: LearningProgressCard(read: 8, total: 8)),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Well done'), findsOneWidget);
      expect(find.text('100%'), findsOneWidget);
    });

    testWidgets('does not divide by zero with no topics yet', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: LearningProgressCard(read: 0, total: 0)),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('0%'), findsOneWidget);
    });
  });

  testWidgets('a tile shows its live line and reacts to a tap', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeTile(
            icon: Icons.vaccines_outlined,
            title: 'Insulin',
            line: 'Today: 8 units',
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    expect(find.text('Today: 8 units'), findsOneWidget);
    await tester.tap(find.text('Insulin'));
    expect(tapped, isTrue);
  });

  /// The failure that reached a real phone: tiles in a Row that stretches, inside
  /// a scrolling list, threw "BoxConstraints forces an infinite height".
  group('tiles inside a scrolling list', () {
    Future<void> pumpGrid(WidgetTester tester, int count) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: [
                TileGrid(
                  tiles: [
                    for (var i = 0; i < count; i++)
                      HomeTile(
                        icon: Icons.quiz_outlined,
                        title: 'Tile $i',
                        line: i == 1
                            ? 'A much longer line that wraps onto a second row'
                            : 'Short',
                        onTap: () {},
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pump();
    }

    for (final count in [1, 2, 3, 4]) {
      testWidgets('lays out $count tile(s) without throwing', (tester) async {
        await pumpGrid(tester, count);
        expect(tester.takeException(), isNull);
        expect(find.text('Tile 0'), findsOneWidget);
      });
    }

    testWidgets('makes tiles in a row the same height', (tester) async {
      await pumpGrid(tester, 2);
      final first = tester.getSize(find.byType(HomeTile).at(0)).height;
      final second = tester.getSize(find.byType(HomeTile).at(1)).height;
      expect(first, second);
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/providers/app_state.dart';
import 'package:t1dpe/screens/health/record_screen.dart';
import 'package:t1dpe/services/api_client.dart';
import 'package:t1dpe/services/carb_service.dart';
import 'package:t1dpe/services/insulin_service.dart';
import 'package:t1dpe/widgets/pin_gate.dart';

/// Recording glucose, insulin and carbohydrates: one simple number and a time,
/// no insulin kinds or names, no meal types, no Rule of 15 and no disclaimer.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    PinSession.unlock();
  });
  tearDown(PinSession.lock);

  group('daily totals', () {
    test('insulin adds up only the doses given that day', () {
      final day = DateTime(2026, 9, 20, 12);
      InsulinDose dose(double units, DateTime at) => InsulinDose(
        id: '$units$at',
        name: 'Insulin',
        type: 'OTHER',
        units: units,
        administeredAt: at,
      );
      expect(
        InsulinService.totalOn(day, [
          dose(4, DateTime(2026, 9, 20, 8)),
          dose(6, DateTime(2026, 9, 20, 19)),
          dose(10, DateTime(2026, 9, 19, 20)),
        ]),
        10,
      );
    });

    test('carbohydrates add up only what was eaten that day', () {
      final day = DateTime(2026, 9, 20, 12);
      CarbEntry entry(double? g, DateTime at) =>
          CarbEntry(id: '$g$at', mealType: 'OTHER', carbsGrams: g, consumedAt: at);
      expect(
        CarbService.totalOn(day, [
          entry(30, DateTime(2026, 9, 20, 8)),
          entry(45, DateTime(2026, 9, 20, 19)),
          entry(60, DateTime(2026, 9, 19, 20)),
          entry(null, DateTime(2026, 9, 20, 9)),
        ]),
        75,
      );
    });
  });

  Future<void> open(WidgetTester tester, RecordKind kind) async {
    await tester.pumpWidget(MaterialApp(home: RecordScreen(initial: kind)));
    // No server in a test: every request waits out the timeout.
    await tester.pump(apiRequestTimeout + const Duration(seconds: 1));
    await tester.pump(apiRequestTimeout + const Duration(seconds: 1));
    await tester.pump();
  }

  testWidgets('glucose is just a number — no disclaimer, no Rule of 15', (
    tester,
  ) async {
    await open(tester, RecordKind.glucose);
    expect(find.text('Glucose reading (mg/dL)'), findsOneWidget);
    expect(find.textContaining('educational aid'), findsNothing);
    expect(find.textContaining('Rule of 15'), findsNothing);
    // A reading is always "now" — no time picker for glucose.
    expect(find.text('Choose a time'), findsNothing);
  });

  testWidgets('insulin asks only units and when — no kind or name', (
    tester,
  ) async {
    await open(tester, RecordKind.insulin);
    expect(find.text('Units given'), findsOneWidget);
    expect(find.text('Now'), findsOneWidget);
    expect(find.text('Choose a time'), findsOneWidget);
    expect(find.textContaining('Rapid-acting'), findsNothing);
    expect(find.textContaining('Insulin name'), findsNothing);
  });

  testWidgets('carbohydrates ask only grams and when — no meal type', (
    tester,
  ) async {
    await open(tester, RecordKind.carbs);
    expect(find.text('Carbohydrates eaten (g)'), findsOneWidget);
    expect(find.text('Breakfast'), findsNothing);
    expect(find.text('Snack'), findsNothing);
  });

  testWidgets('refuses an impossible insulin dose', (tester) async {
    await open(tester, RecordKind.insulin);
    await tester.enterText(find.byType(TextField), '0');
    await tester.tap(find.text('Save'));
    await tester.pump();
    expect(find.textContaining('no more than 300'), findsOneWidget);
  });

  testWidgets('refuses an impossible amount of carbohydrate', (tester) async {
    await open(tester, RecordKind.carbs);
    await tester.enterText(find.byType(TextField), '900');
    await tester.tap(find.text('Save'));
    await tester.pump();
    expect(find.textContaining('no more than 500'), findsOneWidget);
  });

  testWidgets('can switch between the three from the top', (tester) async {
    await open(tester, RecordKind.glucose);
    await tester.tap(find.text('Carbs'));
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.text('Carbohydrates eaten (g)'), findsOneWidget);
  });

  testWidgets('is in Tamil when the app is', (tester) async {
    await AppState.instance.setLocale('ta');
    addTearDown(() => AppState.instance.setLocale('en'));
    await open(tester, RecordKind.insulin);
    expect(find.text('கொடுத்த யூனிட்கள்'), findsOneWidget);
    expect(find.text('இப்போது'), findsOneWidget);
  });

  testWidgets('is behind the parent PIN', (tester) async {
    PinSession.lock();
    await tester.pumpWidget(const MaterialApp(home: RecordScreen()));
    await tester.pump(apiRequestTimeout + const Duration(seconds: 1));
    expect(find.text('Glucose reading (mg/dL)'), findsNothing);
  });
}

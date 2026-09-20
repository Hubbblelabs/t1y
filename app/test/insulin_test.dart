import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/widgets/pin_gate.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/screens/health/insulin_screen.dart';
import 'package:t1dpe/services/api_client.dart';
import 'package:t1dpe/services/insulin_service.dart';

void main() {
  setUp(() {
    PinSession.unlock();
    return;
  });
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('daily total', () {
    InsulinDose dose(double units, DateTime when) => InsulinDose(
      id: '$units$when',
      name: 'Humalog',
      type: 'RAPID_ACTING',
      units: units,
      administeredAt: when,
    );

    test('adds up only the doses given that day', () {
      final today = DateTime(2026, 9, 20, 12);
      final doses = [
        dose(4, DateTime(2026, 9, 20, 8)),
        dose(6, DateTime(2026, 9, 20, 19)),
        dose(10, DateTime(2026, 9, 19, 20)), // yesterday — must not count
      ];
      expect(InsulinService.totalOn(today, doses), 10);
    });

    test('is zero when nothing was given', () {
      expect(InsulinService.totalOn(DateTime(2026, 9, 20), const []), 0);
    });

    test('reads what the server sends', () {
      final d = InsulinDose.fromJson({
        'id': 'a',
        'insulinName': 'Lantus',
        'insulinType': 'LONG_ACTING',
        'doseUnits': 12,
        'administeredAt': '2026-09-20T08:00:00.000Z',
      });
      expect(d.units, 12.0);
      expect(d.type, 'LONG_ACTING');
    });
  });

  group('the form', () {
    Future<void> open(WidgetTester tester) async {
      await tester.pumpWidget(const MaterialApp(home: InsulinScreen()));
      // There is no server here, so the list of recent doses waits out the
      // request timeout (15 s) before the screen settles — which is exactly the
      // behaviour that stops a dead connection hanging a screen for a minute.
      await tester.pump(apiRequestTimeout + const Duration(seconds: 1));
      await tester.pump();
    }

    testWidgets('asks for the name of the insulin', (tester) async {
      await open(tester);

      await tester.tap(find.text('Save'));
      await tester.pump();

      expect(
        find.text('Please enter the name of the insulin.'),
        findsOneWidget,
      );
    });

    testWidgets('refuses a dose of zero', (tester) async {
      await open(tester);

      await tester.enterText(
        find.widgetWithText(TextField, 'Insulin name (e.g. Humalog)'),
        'Humalog',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Dose (units)'),
        '0',
      );
      await tester.tap(find.text('Save'));
      await tester.pump();

      expect(
        find.textContaining('more than 0 and no more than 300'),
        findsOneWidget,
      );
    });

    testWidgets('refuses a dose no one could give', (tester) async {
      await open(tester);

      await tester.enterText(
        find.widgetWithText(TextField, 'Insulin name (e.g. Humalog)'),
        'Humalog',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Dose (units)'),
        '450',
      );
      await tester.tap(find.text('Save'));
      await tester.pump();

      expect(find.textContaining('no more than 300'), findsOneWidget);
    });

    testWidgets('says plainly that it records and does not advise', (
      tester,
    ) async {
      await open(tester);
      expect(
        find.textContaining('does not tell you how much to give'),
        findsOneWidget,
      );
    });
  });
}

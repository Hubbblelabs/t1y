import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/screens/calculators/calculator_screen.dart';
import 'package:t1dpe/services/calculator_runner.dart';
import 'package:t1dpe/services/calculator_service.dart';

/// The calculator screen, driven the way a parent would use it, against the
/// same definitions the dashboard's seeded calculators hold.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    CalculatorService.instance.valuesForOverride = null;
  });

  // The seeded "Insulin ratios — rapid-acting insulin", as the API sends it.
  final rapidActing = Calculator.fromJson({
    'key': 'rapid',
    'nameEn': 'Insulin ratios — rapid-acting insulin',
    'descriptionEn': 'Works out the carb ratio and correction factor.',
    'noteEn': 'Confirm with your diabetes team.',
    'inputs': [
      {
        'key': 'tdd',
        'labelEn': 'Total daily insulin dose',
        'unit': 'units',
        'min': 1,
        'max': 200,
        'source': 'ASK',
      },
    ],
    'outputs': [
      {
        'key': 'icRatio',
        'labelEn': 'Insulin-to-carb ratio',
        'unit': 'g of carbs per unit',
        'decimals': 1,
        'expression': '500 / tdd',
      },
      {
        'key': 'isf',
        'labelEn': 'Correction factor',
        'unit': 'mg/dL per unit',
        'decimals': 0,
        'expression': '1800 / tdd',
      },
    ],
  });

  // A calculator that takes glucose from the child's records.
  final glucoseEcho = Calculator.fromJson({
    'key': 'echo',
    'nameEn': 'Glucose check',
    'inputs': [
      {
        'key': 'glucose',
        'labelEn': 'Most recent glucose reading',
        'unit': 'mg/dL',
        'source': 'DATA',
        'sourceKey': 'glucose_latest',
      },
    ],
    'outputs': [
      {
        'key': 'same',
        'labelEn': 'Glucose in mg/dL',
        'unit': 'mg/dL',
        'decimals': 0,
        'expression': 'glucose',
      },
    ],
  });

  Future<void> open(WidgetTester tester, Calculator calculator) async {
    await tester.pumpWidget(
      MaterialApp(home: CalculatorScreen(calculator: calculator)),
    );
    await tester.pumpAndSettle();
    // Every calculator opens with the disclaimer (UX handoff §23).
    await tester.tap(find.text('I understand'));
    await tester.pumpAndSettle();
  }

  testWidgets('shows the disclaimer before any input', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: CalculatorScreen(calculator: rapidActing)),
    );
    await tester.pumpAndSettle();

    expect(find.text('I understand'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('works out the curriculum ratios from the dashboard formulas', (
    tester,
  ) async {
    await open(tester, rapidActing);

    await tester.enterText(find.byType(TextField), '20');
    await tester.tap(find.text('Calculate'));
    await tester.pumpAndSettle();

    // 500 / 20 and 1800 / 20 — the numbers the hardcoded card always gave.
    expect(find.text('25.0 g of carbs per unit'), findsOneWidget);
    expect(find.text('90 mg/dL per unit'), findsOneWidget);
    expect(find.text('Confirm with your diabetes team.'), findsOneWidget);
  });

  testWidgets('refuses zero and tells the parent what to do', (tester) async {
    await open(tester, rapidActing);

    await tester.enterText(find.byType(TextField), '0');
    await tester.tap(find.text('Calculate'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        '"Total daily insulin dose" must be more than zero. Please check the '
        'number and enter it again.',
      ),
      findsOneWidget,
    );
    expect(find.text('Your result'), findsNothing);
  });

  testWidgets('refuses an empty box rather than working with nothing', (
    tester,
  ) async {
    await open(tester, rapidActing);

    await tester.tap(find.text('Calculate'));
    await tester.pumpAndSettle();

    expect(
      find.text('Enter a number for "Total daily insulin dose".'),
      findsOneWidget,
    );
  });

  testWidgets('refuses a dose outside the range the calculator allows', (
    tester,
  ) async {
    await open(tester, rapidActing);

    await tester.enterText(find.byType(TextField), '900');
    await tester.tap(find.text('Calculate'));
    await tester.pumpAndSettle();

    expect(find.textContaining('cannot be more than 200'), findsOneWidget);
  });

  testWidgets('clears an old answer as soon as a number is changed', (
    tester,
  ) async {
    await open(tester, rapidActing);

    await tester.enterText(find.byType(TextField), '20');
    await tester.tap(find.text('Calculate'));
    await tester.pumpAndSettle();
    expect(find.text('Your result'), findsOneWidget);

    // A result must never sit on screen beside a number it was not made from.
    await tester.enterText(find.byType(TextField), '25');
    await tester.pumpAndSettle();
    expect(find.text('Your result'), findsNothing);
  });

  group('numbers taken from the child\'s records', () {
    testWidgets('fills the box and says how old the reading is', (
      tester,
    ) async {
      CalculatorService.instance.valuesForOverride = (keys) async => {
        'glucose_latest': RecordedValue(
          value: 155,
          recordedAt: DateTime.now().subtract(const Duration(hours: 2)),
        ),
      };
      await open(tester, glucoseEcho);

      expect(find.text('155'), findsOneWidget);
      expect(find.text('From your records · 2 h ago'), findsOneWidget);
    });

    testWidgets('calls it the parent\'s own number once they type over it', (
      tester,
    ) async {
      CalculatorService.instance.valuesForOverride = (keys) async => {
        'glucose_latest': RecordedValue(
          value: 155,
          recordedAt: DateTime.now().subtract(const Duration(days: 3)),
        ),
      };
      await open(tester, glucoseEcho);
      expect(find.text('From your records · 3 days ago'), findsOneWidget);

      await tester.enterText(find.byType(TextField), '110');
      await tester.pumpAndSettle();

      expect(find.textContaining('From your records'), findsNothing);
      expect(find.text('Entered by you'), findsOneWidget);
    });

    testWidgets('asks the parent to type it when nothing is on file', (
      tester,
    ) async {
      CalculatorService.instance.valuesForOverride = (keys) async => {
        'glucose_latest': const RecordedValue(
          missingReason: 'No glucose reading has been recorded yet.',
        ),
      };
      await open(tester, glucoseEcho);

      expect(
        find.text('Nothing on file yet — please enter it yourself.'),
        findsOneWidget,
      );
      // A missing reading is empty, never a zero.
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '',
      );
    });

    testWidgets('still works when the records cannot be reached at all', (
      tester,
    ) async {
      CalculatorService.instance.valuesForOverride = (keys) async => const {};
      await open(tester, glucoseEcho);

      await tester.enterText(find.byType(TextField), '120');
      await tester.tap(find.text('Calculate'));
      await tester.pumpAndSettle();

      expect(find.text('120 mg/dL'), findsOneWidget);
    });
  });

  group('entering a value in another unit', () {
    testWidgets('offers mmol/L for a glucose box', (tester) async {
      CalculatorService.instance.valuesForOverride = (keys) async => const {};
      await open(tester, glucoseEcho);

      expect(find.text('mmol/L'), findsOneWidget);
    });

    /// The reason this exists. 5.5 mmol/L typed into a formula that expects
    /// mg/dL would be read as a glucose of 5.5.
    testWidgets('converts before the formula sees it', (tester) async {
      CalculatorService.instance.valuesForOverride = (keys) async => const {};
      await open(tester, glucoseEcho);

      await tester.tap(find.text('mmol/L'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), '5.5');
      await tester.tap(find.text('Calculate'));
      await tester.pumpAndSettle();

      // 5.5 × 18.0182 = 99.1 mg/dL.
      expect(find.text('99 mg/dL'), findsOneWidget);
    });

    testWidgets('converts what is already in the box when the unit changes', (
      tester,
    ) async {
      CalculatorService.instance.valuesForOverride = (keys) async => {
        'glucose_latest': RecordedValue(value: 180, recordedAt: DateTime.now()),
      };
      await open(tester, glucoseEcho);
      expect(find.text('180'), findsOneWidget);

      await tester.tap(find.text('mmol/L'));
      await tester.pumpAndSettle();

      // The same quantity, not 180 mmol/L.
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '9.99',
      );
    });
  });
}

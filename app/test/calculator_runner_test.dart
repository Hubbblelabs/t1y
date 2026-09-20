import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/services/calculator_runner.dart';

/// These mirror the calculator cases in
/// api/tests/integration/admin-dashboard.test.ts.
///
/// The server refuses a number when an admin tries it in the dashboard; this
/// refuses the same number on a family's phone. If the two ever disagree, a
/// calculator that looked safe when it was written would behave differently
/// in a kitchen — so the rules, and the wording, are asserted on both sides.
void main() {
  CalculatorInput tdd({double? min, double? max}) => CalculatorInput(
    key: 'tdd',
    label: 'Total daily dose',
    unit: 'units',
    min: min,
    max: max,
  );

  const icRatio = CalculatorOutput(
    key: 'icRatio',
    label: 'Carb ratio',
    unit: 'g per unit',
    decimals: 1,
    expression: '500 / tdd',
  );

  group('runCalculator', () {
    test("reproduces the curriculum's own ratio", () {
      final run = runCalculator(
        inputs: [tdd()],
        outputs: const [icRatio],
        values: {'tdd': 20},
      );

      expect(run.ok, isTrue);
      expect(run.results.single.value, 25);
    });

    test('feeds each answer into the ones after it', () {
      final run = runCalculator(
        inputs: [tdd()],
        outputs: const [
          icRatio,
          CalculatorOutput(
            key: 'doubled',
            label: 'Doubled',
            unit: 'g per unit',
            decimals: 1,
            expression: 'icRatio * 2',
          ),
        ],
        values: {'tdd': 20},
      );

      expect(run.ok, isTrue);
      expect(run.results.last.value, 50);
    });

    group('refusals', () {
      test('refuses zero with the same wording as the dashboard', () {
        final run = runCalculator(
          inputs: [tdd()],
          outputs: const [icRatio],
          values: {'tdd': 0},
        );

        expect(run.ok, isFalse);
        expect(
          run.error,
          '"Total daily dose" must be more than zero. Please check the number '
          'and enter it again.',
        );
      });

      test('refuses a negative number', () {
        final run = runCalculator(
          inputs: [tdd()],
          outputs: const [icRatio],
          values: {'tdd': -12},
        );

        expect(run.error, contains('must be more than zero'));
      });

      test('refuses a missing value rather than treating it as zero', () {
        final run = runCalculator(
          inputs: [tdd()],
          outputs: const [icRatio],
          values: const {'tdd': null},
        );

        expect(run.error, 'Enter a number for "Total daily dose".');
      });

      test('refuses a value above the allowed maximum', () {
        final run = runCalculator(
          inputs: [tdd(min: 1, max: 200)],
          outputs: const [icRatio],
          values: {'tdd': 900},
        );

        expect(run.error, '"Total daily dose" cannot be more than 200.');
      });

      test('refuses a value below the allowed minimum', () {
        final run = runCalculator(
          inputs: [tdd(min: 5, max: 200)],
          outputs: const [icRatio],
          values: {'tdd': 2},
        );

        expect(run.error, '"Total daily dose" cannot be less than 5.');
      });

      test('allows zero only when the calculator deliberately permits it', () {
        final run = runCalculator(
          inputs: [
            CalculatorInput(
              key: 'correction',
              label: 'Correction',
              unit: 'units',
              min: -10,
            ),
          ],
          outputs: const [
            CalculatorOutput(
              key: 'doubled',
              label: 'Doubled',
              unit: 'units',
              decimals: 1,
              expression: 'correction * 2',
            ),
          ],
          values: {'correction': 0},
        );

        expect(run.ok, isTrue);
        expect(run.results.single.value, 0);
      });

      test('reports a broken formula in words a parent can read', () {
        final run = runCalculator(
          inputs: [tdd()],
          outputs: const [
            CalculatorOutput(
              key: 'oops',
              label: 'Oops',
              unit: 'x',
              decimals: 1,
              expression: '500 / missing',
            ),
          ],
          values: {'tdd': 20},
        );

        expect(run.error, contains('No value was given for "missing"'));
      });
    });
  });
}

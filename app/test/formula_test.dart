import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/services/formula.dart';

/// These mirror api/tests/unit/formula.test.ts case for case.
///
/// The server validates a formula when an admin writes it; this code works
/// the same text out on a phone. If the two ever disagree, a calculator that
/// looked correct in the dashboard would produce something different for a
/// family — so both suites assert the same results for the same expressions,
/// and a change to one that is not made to the other should fail here.
void main() {
  group('evaluateFormula', () {
    test('applies normal operator precedence', () {
      expect(evaluateFormula('2 + 3 * 4', {}), 14);
      expect(evaluateFormula('(2 + 3) * 4', {}), 20);
    });

    test('handles unary minus, including doubled', () {
      expect(evaluateFormula('-5 + 2', {}), -3);
      expect(evaluateFormula('--5', {}), 5);
      expect(evaluateFormula('3 * -2', {}), -6);
    });

    test('substitutes named values', () {
      expect(evaluateFormula('tdd * 2', {'tdd': 21}), 42);
    });

    test('supports the permitted functions', () {
      expect(evaluateFormula('min(4, 9)', {}), 4);
      expect(evaluateFormula('max(4, 9)', {}), 9);
      expect(evaluateFormula('round(2.5)', {}), 3);
      expect(evaluateFormula('floor(2.9)', {}), 2);
      expect(evaluateFormula('ceil(2.1)', {}), 3);
    });

    test('nests function calls and expressions', () {
      expect(evaluateFormula('max(round(1.4), min(2, 3))', {}), 2);
    });

    group("the curriculum's own formulas", () {
      test('computes the insulin-to-carb ratio as 500 / total daily dose', () {
        expect(evaluateFormula('500 / tdd', {'tdd': 20}), 25);
      });

      test('computes the correction factor with the 1800 rule', () {
        expect(evaluateFormula('1800 / tdd', {'tdd': 30}), 60);
      });

      test('computes the correction factor with the 1500 rule', () {
        expect(evaluateFormula('1500 / tdd', {'tdd': 30}), 50);
      });

      test('computes a meal dose as carbs divided by the ratio', () {
        expect(
          evaluateFormula('carbs / icRatio', {'carbs': 60, 'icRatio': 15}),
          4,
        );
      });
    });

    group('refusals', () {
      test('refuses division by zero rather than returning infinity', () {
        expect(
          () => evaluateFormula('500 / tdd', {'tdd': 0}),
          throwsA(
            isA<FormulaException>().having(
              (e) => e.message,
              'message',
              contains('division by zero'),
            ),
          ),
        );
      });

      test('refuses an unknown name instead of treating it as zero', () {
        expect(
          () => evaluateFormula('dose * 2', {}),
          throwsA(
            isA<FormulaException>().having(
              (e) => e.message,
              'message',
              contains('No value was given for "dose"'),
            ),
          ),
        );
      });

      test('refuses a non-numeric value', () {
        expect(
          () => evaluateFormula('x + 1', {'x': double.nan}),
          throwsA(isA<FormulaException>()),
        );
      });

      test('refuses unbalanced brackets', () {
        expect(
          () => evaluateFormula('(1 + 2', {}),
          throwsA(isA<FormulaException>()),
        );
        expect(
          () => evaluateFormula('1 + 2)', {}),
          throwsA(isA<FormulaException>()),
        );
      });

      test('refuses a malformed number', () {
        expect(
          () => evaluateFormula('1.2.3', {}),
          throwsA(isA<FormulaException>()),
        );
      });

      test('refuses a function called with the wrong number of arguments', () {
        expect(
          () => evaluateFormula('min(1)', {}),
          throwsA(isA<FormulaException>()),
        );
        expect(
          () => evaluateFormula('round(1, 2)', {}),
          throwsA(isA<FormulaException>()),
        );
      });

      test('refuses an empty formula', () {
        expect(() => evaluateFormula('', {}), throwsA(isA<FormulaException>()));
      });

      test('refuses anything that is not arithmetic', () {
        const attacks = [
          "fetch('http://example.com')",
          'globalThis.process',
          'this.constructor',
          'x = 1',
          '1 && 2',
          'a ? b : c',
          'x.y',
          "x['y']",
          '() => 1',
          '1; 2',
        ];
        for (final attack in attacks) {
          expect(
            () => evaluateFormula(attack, {'x': 1, 'a': 1, 'b': 2, 'c': 3}),
            throwsA(isA<FormulaException>()),
            reason: '"$attack" must not evaluate',
          );
        }
      });

      test('refuses an over-long formula', () {
        expect(
          () => evaluateFormula('${'1+' * 400}1', {}),
          throwsA(isA<FormulaException>()),
        );
      });
    });
  });
}

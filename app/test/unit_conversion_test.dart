import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/utils/relative_time.dart';
import 'package:t1dpe/utils/unit_conversion.dart';

void main() {
  group('unit conversion', () {
    test('offers mmol/L to someone whose formula is written in mg/dL', () {
      expect(alternativesFor('mg/dL').map((o) => o.label), ['mmol/L']);
    });

    test('matches units however an admin happens to have written them', () {
      expect(alternativesFor('MG/DL'), isNotEmpty);
      expect(alternativesFor('mg / dl'), isNotEmpty);
    });

    test('offers nothing for a unit with no sensible alternative', () {
      expect(alternativesFor('units'), isEmpty);
      expect(alternativesFor('g per unit'), isEmpty);
      expect(alternativesFor(''), isEmpty);
    });

    /// The reason this exists: 5.5 mmol/L typed into a formula that expects
    /// mg/dL would be read as a glucose of 5.5 and give a dose eighteen times
    /// too small.
    test('turns an mmol/L reading into mg/dL', () {
      expect(toDeclaredUnit(5.5, 'mmol/L', 'mg/dL'), closeTo(99.1, 0.05));
      expect(toDeclaredUnit(10, 'mmol/L', 'mg/dL'), closeTo(180.18, 0.01));
    });

    test('leaves a value alone when it is already in the declared unit', () {
      expect(toDeclaredUnit(120, 'mg/dL', 'mg/dL'), 120);
      expect(toDeclaredUnit(120, 'MG/DL', 'mg/dL'), 120);
    });

    test('converts pounds and inches', () {
      expect(toDeclaredUnit(60, 'lb', 'kg'), closeTo(27.22, 0.01));
      expect(toDeclaredUnit(50, 'in', 'cm'), closeTo(127, 0.01));
    });

    test('never guesses at a unit it does not know', () {
      expect(toDeclaredUnit(7, 'stone', 'kg'), 7);
    });

    test('round trips, so switching unit back and forth does not drift', () {
      final there = fromDeclaredUnit(99.1, 'mmol/L', 'mg/dL');
      expect(there, closeTo(5.5, 0.01));
      expect(toDeclaredUnit(there, 'mmol/L', 'mg/dL'), closeTo(99.1, 0.001));
    });
  });

  group('relative time', () {
    final now = DateTime(2026, 9, 20, 12);

    test('says how long ago, in English', () {
      expect(relativeTime(now, locale: 'en', now: now), 'just now');
      expect(
        relativeTime(
          now.subtract(const Duration(minutes: 5)),
          locale: 'en',
          now: now,
        ),
        '5 min ago',
      );
      expect(
        relativeTime(
          now.subtract(const Duration(hours: 2)),
          locale: 'en',
          now: now,
        ),
        '2 h ago',
      );
      expect(
        relativeTime(
          now.subtract(const Duration(days: 1)),
          locale: 'en',
          now: now,
        ),
        '1 day ago',
      );
      expect(
        relativeTime(
          now.subtract(const Duration(days: 3)),
          locale: 'en',
          now: now,
        ),
        '3 days ago',
      );
    });

    test('says it in Tamil too', () {
      expect(
        relativeTime(
          now.subtract(const Duration(hours: 2)),
          locale: 'ta',
          now: now,
        ),
        '2 மணி முன்',
      );
    });
  });
}

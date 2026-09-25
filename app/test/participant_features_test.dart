import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/services/participant_features.dart';

void main() {
  group('enabledFeaturesFrom', () {
    test('reads the list the server sends', () {
      final me = {
        'profile': {
          'enabledFeatures': ['GLUCOSE_LOGGING', 'HELP_BOOK'],
        },
      };
      expect(enabledFeaturesFrom(me), {kGlucoseLogging, kHelpBook});
    });

    test('is empty, not everything, when the account has none', () {
      final me = {
        'profile': {'enabledFeatures': <String>[]},
      };
      expect(enabledFeaturesFrom(me), isEmpty);
    });

    test('defaults to everything when the field is missing entirely', () {
      // An older cached `me`, saved before this existed.
      final me = {
        'profile': {'name': 'Test'},
      };
      expect(enabledFeaturesFrom(me), kAllParticipantFeatures);
    });

    test('defaults to everything when there is no profile at all', () {
      expect(enabledFeaturesFrom(null), kAllParticipantFeatures);
      expect(enabledFeaturesFrom({}), kAllParticipantFeatures);
    });
  });
}

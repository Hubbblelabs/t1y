import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/providers/app_state.dart';
import 'package:t1dpe/utils/tamil_name.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('writing a name in Tamil', () {
    test('common names, keeping each word', () {
      expect(transliterateToTamil('Priya'), 'ப்ரியா');
      expect(transliterateToTamil('Meena Devi'), 'மீனா டேவி');
      expect(transliterateToTamil('Ravi Kumar'), 'ரவி குமார்');
      expect(transliterateToTamil('Nithya'), 'நித்யா');
    });

    test('leaves Tamil, digits and punctuation alone', () {
      expect(transliterateToTamil('பிரியா'), 'பிரியா');
      expect(transliterateToTamil('A. Kumar'), startsWith('அ.'));
      expect(transliterateToTamil(''), '');
    });

    test('never loses a letter it has no rule for', () {
      expect(transliterateToTamil('Ravi_2'), contains('_2'));
    });
  });

  group('the name on screen', () {
    test('is left as typed in English', () async {
      await AppState.instance.setLocale('en');
      expect(localName('Priya'), 'Priya');
    });

    test('is written in Tamil when the app is in Tamil', () async {
      await AppState.instance.setLocale('ta');
      addTearDown(() => AppState.instance.setLocale('en'));
      expect(localName('Priya'), 'ப்ரியா');
    });
  });
}

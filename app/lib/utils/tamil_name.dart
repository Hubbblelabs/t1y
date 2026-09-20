import '../providers/app_state.dart';

/// A name in the app's current language. In Tamil, a name typed in English
/// letters is written out in Tamil script; a name already in Tamil, or any
/// other script, is left alone.
///
/// This runs on the phone on purpose. A child's name is not sent to a
/// transliteration service, and it works with no connection.
String localName(String name) =>
    AppState.instance.locale == 'ta' ? transliterateToTamil(name) : name;

const _consonants = <String, String>{
  'ksh': 'க்ஷ',
  'chh': 'ச',
  'ch': 'ச',
  'sh': 'ஷ',
  'th': 'த',
  'dh': 'த',
  'kh': 'க',
  'gh': 'க',
  'bh': 'ப',
  'ph': 'ப',
  'jh': 'ஜ',
  'zh': 'ழ',
  'ng': 'ங',
  'k': 'க',
  'g': 'க',
  'c': 'க',
  'j': 'ஜ',
  't': 'ட',
  'd': 'ட',
  'n': 'ன',
  'p': 'ப',
  'b': 'ப',
  'm': 'ம',
  'y': 'ய',
  'r': 'ர',
  'l': 'ல',
  'v': 'வ',
  'w': 'வ',
  's': 'ஸ',
  'h': 'ஹ',
  'z': 'ஜ',
  'f': 'ஃப',
  'q': 'க',
  'x': 'க்ஸ',
};

// Vowels: independent letter, then the sign that follows a consonant.
const _vowels = <String, (String, String)>{
  'aa': ('ஆ', 'ா'),
  'ai': ('ஐ', 'ை'),
  'au': ('ஔ', 'ௌ'),
  'ee': ('ஈ', 'ீ'),
  'ii': ('ஈ', 'ீ'),
  'oo': ('ஊ', 'ூ'),
  'uu': ('ஊ', 'ூ'),
  'a': ('அ', ''),
  'e': ('எ', 'ெ'),
  'i': ('இ', 'ி'),
  'o': ('ஒ', 'ொ'),
  'u': ('உ', 'ு'),
};

const _pulli = '்';

/// Rule-based Latin-to-Tamil spelling, tuned for Indian personal names
/// ("Sahana" → ஸஹானா-style sounds). Anything that is not a Latin letter
/// passes through unchanged.
String transliterateToTamil(String input) {
  final words = input.split(RegExp(r'(?<=\s)|(?=\s)'));
  return words.map(_word).join();
}

bool _isLatin(String ch) => RegExp(r'[A-Za-z]').hasMatch(ch);

String _word(String word) {
  if (!word.split('').any(_isLatin)) return word;
  final w = word.toLowerCase();
  final out = StringBuffer();
  var i = 0;
  var afterConsonant = false; // last thing written was a bare consonant

  while (i < w.length) {
    final ch = w[i];
    if (!_isLatin(ch)) {
      if (afterConsonant) out.write(_pulli);
      afterConsonant = false;
      out.write(word[i]);
      i++;
      continue;
    }

    // A vowel, longest match first.
    final vowel = [3, 2, 1]
        .map((n) => i + n <= w.length ? w.substring(i, i + n) : null)
        .firstWhere(
          (s) => s != null && _vowels.containsKey(s),
          orElse: () => null,
        );
    if (vowel != null) {
      var (independent, sign) = _vowels[vowel]!;
      final end = i + vowel.length;
      final atEnd = end >= w.length;
      // A closing "a" is long in Indian names: Meena, Priya, Kumar.
      if (vowel == 'a' && atEnd && afterConsonant && w.length > 2) {
        sign = 'ா';
      }
      if (vowel == 'a' && afterConsonant && w.substring(end) == 'r') {
        sign = 'ா';
      }
      // "e" and "o" that open a syllable (De-vi, Mo-han) are long.
      if ((vowel == 'e' || vowel == 'o') && !atEnd) {
        final next = w[end];
        final after = end + 1 < w.length ? w[end + 1] : '';
        final openSyllable =
            _isLatin(next) &&
            !'aeiou'.contains(next) &&
            (after.isNotEmpty && 'aeiou'.contains(after));
        if (openSyllable) {
          (independent, sign) = vowel == 'e' ? ('ஏ', 'ே') : ('ஓ', 'ோ');
        }
      }
      if (afterConsonant) {
        out.write(sign);
      } else {
        out.write(independent);
      }
      afterConsonant = false;
      i += vowel.length;
      continue;
    }

    // A consonant, longest match first.
    final cons = [3, 2, 1]
        .map((n) => i + n <= w.length ? w.substring(i, i + n) : null)
        .firstWhere(
          (s) => s != null && _consonants.containsKey(s),
          orElse: () => null,
        );
    if (cons != null) {
      if (afterConsonant) out.write(_pulli);
      // A name starting with n begins with ந, not ன.
      out.write(cons == 'n' && i == 0 ? 'ந' : _consonants[cons]);
      afterConsonant = true;
      i += cons.length;
      continue;
    }

    // A Latin letter we have no rule for: keep it rather than lose it.
    if (afterConsonant) out.write(_pulli);
    afterConsonant = false;
    out.write(word[i]);
    i++;
  }
  if (afterConsonant) out.write(_pulli);
  return out.toString();
}

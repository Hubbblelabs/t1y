import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/config/default_questions.dart';
import 'package:t1dpe/models/question.dart';
import 'package:t1dpe/models/signup_question.dart';
import 'package:t1dpe/services/profile_field_rules.dart';

/// These mirror api/tests/unit/profile-field-rules.test.ts case for case, with
/// the same rules and the same expected messages. The server runs these checks
/// on every added question; this runs them on the phone. If the two ever
/// disagree, a parent would be told an answer is fine and then have the save
/// refused — so a change to one that is not made to the other fails here.
void main() {
  final now = DateTime.utc(2026, 9, 20, 12);

  Question byKey(String key) =>
      defaultQuestions.firstWhere((q) => q.key == key);

  final name = byKey('name');
  final dob = byKey('dateOfBirth');
  final diagnosisYear = byKey('diagnosisYear');

  group('text rules', () {
    test('accepts an English and a Tamil name', () {
      expect(checkAnswer(name, 'Anbu', now: now), isNull);
      expect(checkAnswer(name, 'அன்பு', now: now), isNull);
      expect(checkAnswer(name, "Mary-Ann O'Neil", now: now), isNull);
    });

    test('refuses too short, too long, and non-letters', () {
      expect(checkAnswer(name, 'A', now: now), contains('at least 2'));
      expect(checkAnswer(name, 'x' * 81, now: now), contains('under 80'));
      expect(checkAnswer(name, 'Anbu123', now: now), contains('letters only'));
    });

    test('refuses something that is not text', () {
      expect(checkAnswer(name, 42, now: now), contains('must be text'));
    });
  });

  group('date rules', () {
    test('accepts a plausible birth date', () {
      expect(checkAnswer(dob, '2016-04-10', now: now), isNull);
    });

    test('refuses a date in the future', () {
      expect(checkAnswer(dob, '2027-01-01', now: now), contains('future'));
    });

    test('refuses someone older than the study allows', () {
      expect(
        checkAnswer(dob, '1990-01-01', now: now),
        contains('too long ago'),
      );
    });

    test('refuses something that is not a date', () {
      expect(checkAnswer(dob, 'not-a-date', now: now), contains('valid date'));
    });
  });

  group('number rules', () {
    test('accepts a sensible diagnosis year', () {
      expect(
        checkAnswer(
          diagnosisYear,
          2020,
          now: now,
          answers: {'dateOfBirth': '2016-04-10'},
        ),
        isNull,
      );
    });

    test('refuses a year before 1900 or after this year', () {
      expect(
        checkAnswer(diagnosisYear, 1850, now: now),
        contains('less than 1900'),
      );
      expect(
        checkAnswer(diagnosisYear, 2031, now: now),
        contains('later than 2026'),
      );
    });

    test('refuses a fraction where a whole number is needed', () {
      expect(
        checkAnswer(diagnosisYear, 2020.5, now: now),
        contains('whole number'),
      );
    });

    /// The exact slip the app's own comment describes: diagnosed before born.
    test('refuses a diagnosis earlier than the birth year', () {
      expect(
        checkAnswer(
          diagnosisYear,
          2015,
          now: now,
          answers: {'dateOfBirth': '2018-06-01'},
        ),
        contains('cannot be earlier than 2018'),
      );
    });

    test('does not compare against a birth date that was never given', () {
      expect(checkAnswer(diagnosisYear, 2015, now: now), isNull);
    });

    test('enforces a measurement range', () {
      final height = byKey('heightCm');
      expect(checkAnswer(height, 120, now: now), isNull);
      expect(checkAnswer(height, 20, now: now), contains('less than 50'));
      expect(checkAnswer(height, 400, now: now), contains('more than 280'));
      expect(
        checkAnswer(height, double.nan, now: now),
        contains('must be a number'),
      );
    });
  });

  group('ageInYears', () {
    test('does not count a birthday that has not happened yet', () {
      expect(ageInYears(DateTime.utc(2016, 10, 1), now), 9);
      expect(ageInYears(DateTime.utc(2016, 9, 20), now), 10);
    });
  });

  group('the sign-up chat', () {
    test('accepts good answers to the four sign-up questions', () {
      expect(validateSignupAnswer(name, 'Anbu'), isNull);
      expect(validateSignupAnswer(dob, '2016-04-10'), isNull);
      expect(validateSignupAnswer(byKey('sex'), 'FEMALE'), isNull);
      expect(
        validateSignupAnswer(
          diagnosisYear,
          '2020',
          priorAnswers: {'dateOfBirth': '2016-04-10'},
        ),
        isNull,
      );
    });

    test('refuses an empty answer to a required question', () {
      expect(validateSignupAnswer(name, '   '), 'This is required.');
    });

    test('lets an optional question be skipped', () {
      expect(validateSignupAnswer(byKey('phone'), ''), isNull);
    });

    test('refuses a sex that is not one of the options', () {
      // What is stored is the value, not the wording the chip showed.
      expect(
        validateSignupAnswer(byKey('sex'), 'Female'),
        'Choose one of the options.',
      );
    });

    test('says a non-number is not a year, not just "a number"', () {
      expect(
        validateSignupAnswer(diagnosisYear, 'abc'),
        'Enter a valid year, e.g. ${DateTime.now().year}.',
      );
    });

    test('refuses a diagnosis before the birth year using earlier answers', () {
      expect(
        validateSignupAnswer(
          diagnosisYear,
          '2015',
          priorAnswers: {'dateOfBirth': '2018-06-01'},
        ),
        contains('cannot be earlier than 2018'),
      );
    });

    test('shows the wording of a choice, not the stored value', () {
      expect(displayAnswer(byKey('sex'), 'FEMALE', 'en'), 'Female');
      expect(displayAnswer(byKey('sex'), 'FEMALE', 'ta'), 'பெண்');
    });
  });

  group('the bundled questions', () {
    test('include the four sign-up questions, in order, all required', () {
      final atSignup = defaultQuestions.where((q) => q.showOnSignup).toList();
      expect(atSignup.map((q) => q.key), [
        'name',
        'dateOfBirth',
        'sex',
        'diagnosisYear',
      ]);
      expect(atSignup.every((q) => q.required), isTrue);
    });

    test(
      'are the thirteen the dashboard lists, none added and none missing',
      () {
        expect(defaultQuestions, hasLength(13));
        expect(defaultQuestions.map((q) => q.key).toSet(), hasLength(13));
      },
    );

    test('are all built in and each gives its sign-up sentence when asked', () {
      expect(defaultQuestions.every((q) => q.builtIn), isTrue);
      expect(name.prompt('en'), 'What is your child name?');
      // A question with no sentence falls back to its label.
      expect(byKey('phone').prompt('en'), 'Phone');
    });

    test(
      'give Tamil wording where the app has it, and fall back where not',
      () {
        expect(byKey('city').label('ta'), 'நகரம்');
        const noTamil = Question(
          key: 'x',
          fieldType: 'TEXT',
          labelEn: 'School',
        );
        expect(noTamil.label('ta'), 'School');
      },
    );
  });

  group('Question round trip', () {
    test('survives being cached and read back', () {
      final original = byKey('treatmentModality');
      final copy = Question.fromJson(original.toJson());

      expect(copy.key, original.key);
      expect(
        copy.options.map((o) => o.value),
        original.options.map((o) => o.value),
      );
      expect(copy.builtIn, isTrue);
    });

    test('reads what the server sends, ignoring what it does not know', () {
      final q = Question.fromJson({
        'key': 'school',
        'fieldType': 'TEXT',
        'labelEn': 'School',
        'rules': {'maxLength': 40},
        'somethingNew': true,
      });
      expect(q.builtIn, isFalse);
      expect(q.rules['maxLength'], 40);
    });
  });
}

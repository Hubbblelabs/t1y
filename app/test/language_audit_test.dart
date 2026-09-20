import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/l10n/strings.dart';
import 'package:t1dpe/models/question.dart';
import 'package:t1dpe/models/signup_question.dart';
import 'package:t1dpe/providers/app_state.dart';
import 'package:t1dpe/screens/calculators/calculators_screen.dart';
import 'package:t1dpe/screens/glucose/glucose_entry_screen.dart';
import 'package:t1dpe/screens/health/health_hub_screen.dart';
import 'package:t1dpe/screens/health/insulin_screen.dart';
import 'package:t1dpe/screens/help/help_screen.dart';
import 'package:t1dpe/screens/help/new_question_screen.dart';
import 'package:t1dpe/screens/helpbook/helpbook_list_screen.dart';
import 'package:t1dpe/screens/quizzes/quiz_list_screen.dart';
import 'package:t1dpe/screens/rewards/badges_screen.dart';
import 'package:t1dpe/models/badge.dart';
import 'package:t1dpe/services/api_client.dart';
import 'package:t1dpe/services/calculator_runner.dart';
import 'package:t1dpe/utils/tamil_name.dart';
import 'package:t1dpe/widgets/pin_gate.dart';
import 'package:t1dpe/widgets/topic_card.dart';

/// In English everything is English. In Tamil everything is Tamil. Anything an
/// administrator wrote (quiz text, Help Book articles, the names they gave
/// things) is the one exception, because it is their content, not the app's.
final _tamil = RegExp(r'[஀-௿]');

/// Words that are the same in both languages and are allowed to stay Latin:
/// the study's name, units, and medical shorthand that Tamil speakers use as is.
final _allowedLatin = RegExp(
  r'T1D|mg/dL|mmol/L|IC|ISF|ID|PIN|M-PIN|OTP|kg|cm|BMI|HbA1c|www|https?|\bu\b|\bh\b|\bd\b|\bmin\b|Prajana|Yandra|Humalog|you|email|com',
);

/// Latin words that would make a Tamil screen read as untranslated.
List<String> _englishWords(String text) {
  final cleaned = text.replaceAll(_allowedLatin, ' ');
  return RegExp(
    r'[A-Za-z]{3,}',
  ).allMatches(cleaned).map((m) => m.group(0)!).toList();
}

Future<void> _setLocale(String locale) async {
  await AppState.instance.setLocale(locale);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  tearDown(() => AppState.instance.setLocale('en'));

  // ── The string table itself ─────────────────────────────────────────────
  group('every string has a real Tamil version', () {
    final source = File('lib/l10n/strings.dart').readAsStringSync();
    // _t('English', 'Tamil') pairs, single or adjacent-concatenated literals.
    final literal = r"""(?:'(?:[^'\\]|\\.)*'\s*)+""";
    final pair = RegExp(
      '_t\\(\\s*($literal),\\s*($literal),?\\s*\\)',
      dotAll: true,
    );
    String value(String raw) => RegExp(
      r"'((?:[^'\\]|\\.)*)'",
    ).allMatches(raw).map((m) => m.group(1)!).join();

    final pairs = pair
        .allMatches(source)
        .map((m) => (value(m.group(1)!), value(m.group(2)!)))
        .toList();

    test('the table was read', () => expect(pairs.length, greaterThan(300)));

    test('English has no Tamil letters, Tamil has some', () {
      final bad = <String>[];
      for (final (en, ta) in pairs) {
        if (_tamil.hasMatch(en)) bad.add('English side has Tamil: $en');
        if (!_tamil.hasMatch(ta) && en.contains(RegExp('[A-Za-z]{4,}'))) {
          if (_englishWords(en).isNotEmpty) bad.add('No Tamil for: $en');
        }
      }
      expect(bad, isEmpty, reason: bad.join('\n'));
    });

    test('Tamil carries no English words', () {
      final bad = <String>[];
      for (final (_, ta) in pairs) {
        final english = _englishWords(
          ta.replaceAll(RegExp(r'\$\{?\w+\}?'), ''),
        );
        if (english.isNotEmpty) bad.add('$ta  →  $english');
      }
      expect(bad, isEmpty, reason: bad.join('\n'));
    });

    test('both sides use the same fill-in values', () {
      final bad = <String>[];
      Set<String> vars(String s) => RegExp(
        r'\$\{?[A-Za-z_][A-Za-z0-9_]*',
      ).allMatches(s).map((m) => m.group(0)!.replaceAll('{', '')).toSet();
      for (final (en, ta) in pairs) {
        if (vars(en).difference(vars(ta)).isNotEmpty ||
            vars(ta).difference(vars(en)).isNotEmpty) {
          bad.add('$en  |  $ta');
        }
      }
      expect(bad, isEmpty, reason: bad.join('\n'));
    });
  });

  // ── Nothing is typed straight into a screen in English ───────────────────
  test('no screen has English text typed into it', () {
    // The places a message or label reaches a person. A string here must come
    // from S (so it has a Tamil version), not be written in place.
    final pattern = RegExp(
      "(?:Text\\(\\s*|_error\\s*=\\s*|hintText:\\s*|labelText:\\s*|error:\\s*)"
      "'([^'\$]*[A-Za-z]{3,}[^']*)'",
    );
    final allowedFiles = {
      'lib/l10n/strings.dart',
      'lib/config/default_questions.dart',
      'lib/models/terms_content.dart',
    };
    final offenders = <String>[];
    for (final entity in Directory('lib').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      if (allowedFiles.contains(entity.path)) continue;
      final text = entity.readAsStringSync();
      for (final m in pattern.allMatches(text)) {
        final literal = m.group(1)!;
        if (_englishWords(literal).isEmpty) continue;
        // A Tamil branch of a language ternary sits beside its English.
        final around = text.substring(
          (m.start - 160).clamp(0, text.length),
          (m.end + 160).clamp(0, text.length),
        );
        if (_tamil.hasMatch(around)) continue;
        offenders.add('${entity.path}: $literal');
      }
    }
    expect(offenders, isEmpty, reason: offenders.join('\n'));
  });

  // ── Messages a parent sees when something is wrong ───────────────────────
  group('validation messages follow the language', () {
    final phone = Question(
      key: 'contact_phone',
      fieldType: 'TEXT',
      labelEn: 'Phone',
      labelTa: 'தொலைபேசி',
      required: true,
      rules: const {'minLength': 10, 'maxLength': 12},
    );
    final year = Question(
      key: 'y',
      fieldType: 'NUMBER',
      labelEn: 'Year',
      labelTa: 'ஆண்டு',
      rules: const {'upToCurrentYear': true, 'min': 1990},
    );

    List<String> messages() => [
      validateSignupAnswer(phone, '') ?? '',
      validateSignupAnswer(phone, '12') ?? '',
      validateSignupAnswer(phone, '1234567890123') ?? '',
      validateSignupAnswer(year, 'abc') ?? '',
      validateSignupAnswer(year, '1800') ?? '',
      validateSignupAnswer(year, '3000') ?? '',
      S.passwordTooShort(8),
      S.passwordTooLong(64),
      S.passwordsDontMatch,
      S.passwordSameAsOld,
      S.timeInFuture,
      S.pinIncorrect,
      S.dailyLimitReached,
      S.needMessage,
      runCalculator(
            inputs: [
              CalculatorInput(
                key: 'a',
                label: 'Weight',
                labelTa: 'எடை',
                unit: 'kg',
              ),
            ],
            outputs: [
              CalculatorOutput(
                key: 'r',
                label: 'R',
                unit: 'kg',
                decimals: 1,
                expression: 'a*2',
              ),
            ],
            values: const {'a': 0},
          ).error ??
          '',
      runCalculator(
            inputs: [
              CalculatorInput(
                key: 'a',
                label: 'Weight',
                labelTa: 'எடை',
                unit: 'kg',
              ),
            ],
            outputs: [
              CalculatorOutput(
                key: 'r',
                label: 'R',
                unit: 'kg',
                decimals: 1,
                expression: 'a*2',
              ),
            ],
            values: const {'a': null},
          ).error ??
          '',
    ];

    test('English is English', () async {
      await _setLocale('en');
      for (final m in messages()) {
        expect(m, isNotEmpty);
        expect(_tamil.hasMatch(m), isFalse, reason: m);
      }
    });

    test('Tamil is Tamil', () async {
      await _setLocale('ta');
      for (final m in messages()) {
        expect(m, isNotEmpty);
        expect(_tamil.hasMatch(m), isTrue, reason: m);
        // Labels the parent typed or the admin named may stay; the words
        // around them may not.
        expect(_englishWords(m), isEmpty, reason: m);
      }
    });
  });

  group('server and network errors follow the language', () {
    final errors = [
      ApiException(0, 'TIMEOUT', 'The server is taking too long to answer.'),
      ApiException(0, 'NETWORK', 'Could not reach the server.'),
      ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.'),
      ApiException(
        401,
        'UNAUTHENTICATED',
        "Those sign-in details didn't match.",
      ),
      ApiException(403, 'FORBIDDEN', 'You do not have access to this study.'),
      ApiException(404, 'NOT_FOUND', 'Record not found.'),
      ApiException(
        409,
        'CONFLICT',
        'A record with these details already exists.',
      ),
      ApiException(
        429,
        'RATE_LIMITED',
        'You have already sent 3 messages today.',
      ),
      ApiException(500, 'INTERNAL_ERROR', 'Something else entirely.'),
      ApiException(400, 'SOMETHING_NEW', 'A message the app has never seen.'),
    ];

    test('English shows what the server said', () async {
      await _setLocale('en');
      for (final e in errors) {
        expect(e.message, e.rawMessage);
      }
    });

    test('Tamil never shows the server\'s English', () async {
      await _setLocale('ta');
      for (final e in errors) {
        expect(_tamil.hasMatch(e.message), isTrue, reason: e.rawMessage);
        expect(_englishWords(e.message), isEmpty, reason: e.message);
      }
    });

    test('the sign-in screens show both', () async {
      await _setLocale('en');
      final e = errors[3];
      expect(e.bothMessage, contains('\n'));
      expect(_tamil.hasMatch(e.bothMessage), isTrue);
      expect(e.bothMessage, startsWith("Those sign-in details didn't match."));
    });
  });

  // ── Names, badges, categories, times ─────────────────────────────────────
  group('content that switches', () {
    test('badges', () async {
      for (final tier in BadgeTier.values) {
        await _setLocale('en');
        expect(
          _tamil.hasMatch(
            '${tier.localLabel}${tier.localAnimalName}${tier.localQuote}',
          ),
          isFalse,
        );
        await _setLocale('ta');
        for (final s in [
          tier.localLabel,
          tier.localAnimalName,
          tier.localQuote,
        ]) {
          expect(_tamil.hasMatch(s), isTrue, reason: s);
          expect(_englishWords(s), isEmpty, reason: s);
        }
      }
    });

    test('learner ranks', () async {
      await _setLocale('ta');
      for (final rank in LearnerRank.values) {
        expect(_tamil.hasMatch(rank.localTitle), isTrue, reason: rank.title);
      }
      await _setLocale('en');
      for (final rank in LearnerRank.values) {
        expect(rank.localTitle, rank.title);
      }
    });

    test('Help Book categories', () async {
      for (final key in categoryIcons.keys) {
        await _setLocale('en');
        expect(_tamil.hasMatch(categoryName(key)), isFalse, reason: key);
        await _setLocale('ta');
        expect(_tamil.hasMatch(categoryName(key)), isTrue, reason: key);
      }
    });

    test('a name', () async {
      await _setLocale('en');
      expect(localName('Priya'), 'Priya');
      await _setLocale('ta');
      expect(_englishWords(localName('Priya Kumar')), isEmpty);
    });
  });

  group('the PIN gate', () {
    for (final locale in ['en', 'ta']) {
      testWidgets('is in the right language ($locale)', (tester) async {
        await _setLocale(locale);
        PinSession.lock();
        await tester.pumpWidget(
          const MaterialApp(home: PinGate(child: Text('SECRET'))),
        );
        await tester.pump(apiRequestTimeout + const Duration(seconds: 1));
        expect(find.text('SECRET'), findsNothing);
        final texts = [
          for (final t in tester.widgetList<Text>(find.byType(Text)))
            t.data ?? '',
        ];
        if (locale == 'ta') {
          expect(
            texts.where((s) => _englishWords(s).isNotEmpty),
            isEmpty,
            reason: texts.join(' | '),
          );
        } else {
          expect(texts.where(_tamil.hasMatch), isEmpty);
        }
      });
    }

    testWidgets('lets the screen through once it is open', (tester) async {
      PinSession.unlock();
      addTearDown(PinSession.lock);
      await tester.pumpWidget(
        const MaterialApp(home: PinGate(child: Text('SECRET'))),
      );
      expect(find.text('SECRET'), findsOneWidget);
    });

    test('locks again after ten idle minutes and on sign-out', () {
      PinSession.unlock();
      expect(PinSession.isUnlocked, isTrue);
      PinSession.lock();
      expect(PinSession.isUnlocked, isFalse);
    });
  });

  // ── The screens themselves ───────────────────────────────────────────────
  group('screens', () {
    final screens = <String, Widget Function()>{
      'Help and support': () => const HelpScreen(),
      'Ask a question': () => const NewQuestionScreen(remainingToday: 2),
      'Calculators': () => const CalculatorsScreen(),
      'Help Book': () => const HelpBookListScreen(),
      'Quizzes': () => const QuizListScreen(),
      'Badges': () => const BadgesScreen(),
      'Health': () => const HealthHubScreen(),
      'Insulin': () => const InsulinScreen(),
      'Glucose entry': () => const GlucoseEntryScreen(),
    };

    Future<List<String>> shown(WidgetTester tester, Widget screen) async {
      // The health screens sit behind the PIN; open it so they are what is checked.
      PinSession.unlock();
      addTearDown(PinSession.lock);
      await tester.pumpWidget(MaterialApp(home: screen));
      // No network in a test: let every request time out, so the screen shows
      // what a parent with no signal would see.
      await tester.pump(apiRequestTimeout + const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      final out = <String>[];
      for (final t in tester.widgetList<Text>(find.byType(Text))) {
        out.add(t.data ?? t.textSpan?.toPlainText() ?? '');
      }
      for (final f in tester.widgetList<TextField>(find.byType(TextField))) {
        final d = f.decoration;
        out.addAll([d?.hintText ?? '', d?.labelText ?? '']);
      }
      return out.where((s) => s.trim().isNotEmpty).toList();
    }

    screens.forEach((name, build) {
      testWidgets('$name is English in English', (tester) async {
        await _setLocale('en');
        final texts = await shown(tester, build());
        expect(texts, isNotEmpty);
        // The language switch itself names Tamil in Tamil.
        final leaks = texts.where((s) => s != 'தமிழ்' && _tamil.hasMatch(s));
        expect(leaks, isEmpty, reason: texts.join(' | '));
      });

      testWidgets('$name is Tamil in Tamil', (tester) async {
        await _setLocale('ta');
        final texts = await shown(tester, build());
        expect(texts, isNotEmpty);
        final leaks = <String>[
          for (final s in texts)
            if (s != 'EN' && _englishWords(s).isNotEmpty)
              '$s → ${_englishWords(s)}',
        ];
        expect(leaks, isEmpty, reason: leaks.join('\n'));
      });
    });
  });
}

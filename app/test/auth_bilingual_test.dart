import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/l10n/strings.dart';
import 'package:t1dpe/providers/app_state.dart';
import 'package:t1dpe/screens/auth/get_started_screen.dart';
import 'package:t1dpe/screens/auth/identifier_entry_screen.dart';
import 'package:t1dpe/screens/auth/signup_password_screen.dart';
import 'package:t1dpe/screens/auth/terms_screen.dart';
import 'package:t1dpe/widgets/bilingual.dart';
import 'package:t1dpe/widgets/language_toggle.dart';

/// The sign-in and sign-up screens do not follow the language switch. They show
/// English, with the Tamil translation beneath it in a smaller size, so nobody
/// has to find a toggle before they can read what they are being asked.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> show(WidgetTester tester, Widget screen) async {
    await tester.pumpWidget(MaterialApp(home: screen));
    await tester.pump(const Duration(milliseconds: 300));
  }

  group('reading a string in a language', () {
    test('gives the same wording in both, whatever the app is set to', () {
      final both = S.both(() => S.continueLabel);
      expect(both.en, 'Continue');
      expect(both.ta, isNot('Continue'));
      expect(both.ta, isNotEmpty);
    });

    test('puts the app back the way it was', () {
      final before = S.continueLabel;
      S.both(() => S.continueLabel);
      expect(S.continueLabel, before);
    });

    test('restores it even if the read throws', () {
      final before = S.continueLabel;
      expect(
        () => S.inLocale<String>('ta', () => throw StateError('boom')),
        throwsStateError,
      );
      expect(S.continueLabel, before);
    });
  });

  group('the widget', () {
    testWidgets('shows English with the Tamil smaller beneath', (tester) async {
      await show(
        tester,
        const Scaffold(
          body: Bilingual(
            'Welcome',
            'வரவேற்கிறோம்',
            style: TextStyle(fontSize: 30),
          ),
        ),
      );

      final english = tester.widget<Text>(find.text('Welcome'));
      final tamil = tester.widget<Text>(find.text('வரவேற்கிறோம்'));
      expect(english.style!.fontSize, 30);
      expect(tamil.style!.fontSize, lessThan(30));
      // Beneath, not beside.
      expect(
        tester.getTopLeft(find.text('வரவேற்கிறோம்')).dy,
        greaterThan(tester.getTopLeft(find.text('Welcome')).dy),
      );
    });

    testWidgets('does not repeat a line that is the same in both', (
      tester,
    ) async {
      await show(
        tester,
        const Scaffold(body: Bilingual('IC / ISF', 'IC / ISF')),
      );
      expect(find.text('IC / ISF'), findsOneWidget);
    });
  });

  group('the screens', () {
    testWidgets('Get Started shows both, with no language switch', (
      tester,
    ) async {
      await show(tester, const GetStartedScreen());

      expect(find.text('Get Started'), findsOneWidget);
      expect(find.text('தொடங்குங்கள்'), findsOneWidget);
      // The tagline in both, together — not taking turns.
      expect(
        find.textContaining('For every brave little fighter'),
        findsOneWidget,
      );
      expect(find.textContaining('ஒவ்வொரு குழந்தைக்கும்'), findsOneWidget);
      expect(find.byType(LanguageToggle), findsNothing);
    });

    testWidgets(
      'sign-in shows English and Tamil even when the app is set to Tamil',
      (tester) async {
        await AppState.instance.setLocale('ta');
        addTearDown(() => AppState.instance.setLocale('en'));

        await show(tester, const IdentifierEntryScreen());

        // English is still the main line.
        expect(find.text(S.both(() => S.welcome).en), findsWidgets);
        expect(find.text(S.both(() => S.welcome).ta), findsWidgets);
        expect(find.byType(LanguageToggle), findsNothing);
      },
    );

    testWidgets('create-account shows both languages', (tester) async {
      await show(tester, const SignupPasswordScreen(email: 'a@example.test'));

      expect(find.text('Create Account'), findsOneWidget);
      expect(find.text('கணக்கை உருவாக்கு'), findsOneWidget);
      expect(find.text('New password'), findsOneWidget);
      expect(find.text('புதிய கடவுச்சொல்'), findsOneWidget);
      expect(find.byType(LanguageToggle), findsNothing);
    });

    testWidgets('the terms have no language switch and carry both texts', (
      tester,
    ) async {
      await show(tester, const TermsScreen());

      expect(find.byType(LanguageToggle), findsNothing);
      // Both the English text and its Tamil translation are on the page — a
      // parent cannot consent to terms they cannot read.
      expect(find.textContaining('Terms', findRichText: true), findsWidgets);
      expect(
        find.textContaining('விதிமுறைகள்', findRichText: true),
        findsWidgets,
      );
    });
  });
}

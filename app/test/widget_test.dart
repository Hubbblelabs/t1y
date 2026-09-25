import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:t1dpe/main.dart';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});

    // No network in the widget test sandbox — fall back to the platform
    // default font instead of google_fonts trying (and failing) to fetch.
    GoogleFonts.config.allowRuntimeFetching = false;

    // flutter_secure_storage has no platform implementation in the widget
    // test environment; stub its method channel so `read` resolves to null
    // (unauthenticated) instead of throwing a MissingPluginException.
    const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      channel,
      (call) async => null,
    );
  });

  testWidgets('Startup gate shows the Get Started screen when signed out', (WidgetTester tester) async {
    await tester.pumpWidget(const T1dpeApp());
    // Not pumpAndSettle: the orbit animation on this screen repeats forever.
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('T1D Prajana Yandra'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);
  });

  testWidgets('Get Started leads to the email entry screen', (WidgetTester tester) async {
    await tester.pumpWidget(const T1dpeApp());
    await tester.pump(const Duration(milliseconds: 500));

    await tester.tap(find.text('Get Started'));
    // Not pumpAndSettle: WaveHeader's decorative dots animate forever too.
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Welcome'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget); // email only, at this step
  });
}

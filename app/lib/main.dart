import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'providers/app_state.dart';
import 'screens/auth/get_started_screen.dart';
import 'screens/home/home_shell.dart';
import 'services/auth_service.dart';
import 'services/content_service.dart';
import 'services/progress_service.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // The Android system navigation bar defaults to an opaque white strip
  // that isn't part of any screen's own background — left unstyled it
  // shows as a plain white bar at the bottom regardless of what the app
  // draws. Make both system bars transparent so the app's own background
  // (whatever screen is behind it) shows through instead.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  // Restore the saved language before the first frame. Without this the app
  // always started in English and silently discarded the participant's
  // choice on every cold start.
  await AppState.instance.load();

  runApp(const T1dpeApp());
}

class T1dpeApp extends StatefulWidget {
  const T1dpeApp({super.key});

  @override
  State<T1dpeApp> createState() => _T1dpeAppState();
}

class _T1dpeAppState extends State<T1dpeApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _backgroundSync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _backgroundSync();
  }

  /// Pulls fresh content when the local copy is over a day old, and pushes
  /// any progress events queued while offline. Both no-op when there is
  /// nothing to do, so running this on every resume is cheap.
  Future<void> _backgroundSync() async {
    if (!await AuthService.instance.isSignedIn) return;
    await ProgressService.instance.flush();
    await ContentService.instance.syncIfStale();
  }

  @override
  Widget build(BuildContext context) {
    // Listens to AppState so a language switch re-applies the Tamil text
    // scale below immediately, not just on the next cold start.
    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => MaterialApp(
        title: 'T1D Prajana Yandra',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        // The app has no considered dark-mode design — AppTheme.dark() is a
        // stub with a near-black scaffold background, which was flashing
        // briefly on screen transitions for anyone with system dark mode on
        // (the new route's dark Scaffold canvas painting before its own
        // light gradient content did). Lock to light until dark mode is
        // actually designed.
        themeMode: ThemeMode.light,
        builder: (context, child) {
          // Tamil script reads smaller than Latin at the same point size —
          // a small app-wide bump, on top of whatever text-scale the device
          // accessibility settings already apply (never replacing it).
          final media = MediaQuery.of(context);
          const tamilBump = 1.08;
          final scale = AppState.instance.isTamil
              ? media.textScaler.scale(1.0) * tamilBump
              : media.textScaler.scale(1.0);
          return MediaQuery(
            data: media.copyWith(textScaler: TextScaler.linear(scale)),
            child: child!,
          );
        },
        home: const _StartupGate(),
      ),
    );
  }
}

/// Routes to Home if a bearer token is already stored, otherwise the
/// Get Started splash.
class _StartupGate extends StatelessWidget {
  const _StartupGate();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: AuthService.instance.isSignedIn,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snapshot.data == true ? const HomeShell() : const GetStartedScreen();
      },
    );
  }
}

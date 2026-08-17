import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/auth/get_started_screen.dart';
import 'screens/home/home_shell.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';

void main() {
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
  runApp(const T1dpeApp());
}

class T1dpeApp extends StatelessWidget {
  const T1dpeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
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
      home: const _StartupGate(),
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

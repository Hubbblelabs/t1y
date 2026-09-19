import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/profile_service.dart';
import '../home/home_shell.dart';
import 'auth_loading_screen.dart';

/// Loader shown while the account is created — see [AuthLoadingScreen] for
/// the actual ring + rotating-message UI, shared with the sign-in loader.
///
/// The account is active immediately (no coordinator approval gate on this
/// path — see api/lib/auth/auth.ts), so this signs straight in and goes to
/// Home, the same shape as [LoginLoadingScreen] rather than stopping at a
/// separate "account created" screen.
class SignupLoadingScreen extends StatelessWidget {
  final String email;
  final String password;
  final String name;

  const SignupLoadingScreen({
    super.key,
    required this.email,
    required this.password,
    required this.name,
  });

  static const _steps = [
    (
      title: 'Creating your account',
      subtitle: 'for the T1D Prajana Yandra study',
    ),
    (
      title: 'Preparing your Help Book',
      subtitle: '8 topics, in English and Tamil',
    ),
    (
      title: 'Getting your quizzes ready',
      subtitle: 'so you can check understanding as you learn',
    ),
    (title: 'Almost done', subtitle: 'just a moment more'),
  ];

  @override
  Widget build(BuildContext context) {
    return AuthLoadingScreen(
      task: () async {
        await AuthService.instance.signUp(
          email: email,
          password: password,
          name: name,
        );
        // First authenticated moment — send the sign-up chat's answers,
        // which had no session to be saved with at the time.
        await ProfileService.instance.flushPendingProfile();
      },
      onSuccess: (_) => const HomeShell(),
      // Signed in — the email/password/chat screens must not remain behind Home.
      clearStack: true,
      steps: _steps,
    );
  }
}

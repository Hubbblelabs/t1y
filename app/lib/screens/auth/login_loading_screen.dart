import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../services/profile_service.dart';
import '../home/home_shell.dart';
import 'auth_loading_screen.dart';
import 'change_password_screen.dart';

/// Loader shown while signing in — see [AuthLoadingScreen] for the actual
/// ring + rotating-message UI, shared with the sign-up loader.
class LoginLoadingScreen extends StatelessWidget {
  final String email;
  final String password;

  const LoginLoadingScreen({
    super.key,
    required this.email,
    required this.password,
  });

  static const _steps = [
    (title: 'Signing you in', subtitle: 'welcome back to T1D Prajana Yandra'),
    (
      title: 'Loading your Help Book',
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
    // Captured by both closures below, which are built in this same call —
    // set inside `task`, read by `onSuccess` once `task` has completed.
    var mustChangePassword = false;

    return AuthLoadingScreen(
      task: () async {
        mustChangePassword = await AuthService.instance.signIn(email: email, password: password);
        // First authenticated moment — send any child details captured during
        // sign-up, which had no session to be saved with at the time.
        await ProfileService.instance.flushPendingProfile();
      },
      onSuccess: (_) => mustChangePassword
          ? ChangePasswordScreen(currentPassword: password)
          : const HomeShell(),
      // Signed in — the email/password screens must not remain behind Home.
      clearStack: true,
      steps: _steps,
    );
  }
}

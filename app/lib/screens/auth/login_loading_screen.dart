import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../home/home_shell.dart';
import 'auth_loading_screen.dart';

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
    return AuthLoadingScreen(
      task: () => AuthService.instance.signIn(email: email, password: password),
      onSuccess: (_) => const HomeShell(),
      steps: _steps,
    );
  }
}

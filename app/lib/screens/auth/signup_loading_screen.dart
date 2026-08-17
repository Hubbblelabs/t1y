import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import 'auth_loading_screen.dart';
import 'signup_complete_screen.dart';

/// Loader shown while the account is created — see [AuthLoadingScreen] for
/// the actual ring + rotating-message UI, shared with the sign-in loader.
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
      task: () => AuthService.instance.signUp(
        email: email,
        password: password,
        name: name,
      ),
      onSuccess: (_) => SignupCompleteScreen(email: email),
      steps: _steps,
    );
  }
}

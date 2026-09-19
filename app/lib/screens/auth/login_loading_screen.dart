import 'package:flutter/material.dart';

import '../../services/household_service.dart';
import '../../services/profile_service.dart';
import '../home/home_shell.dart';
import 'auth_loading_screen.dart';
import 'change_password_screen.dart';

/// Loader shown while signing in — see [AuthLoadingScreen] for the actual
/// ring + rotating-message UI, shared with the sign-up loader.
///
/// Signs in through the household flow rather than Better Auth directly, so
/// that one code path covers every identifier a family might use: the
/// parent's email, their phone, or the child's own ID.
class LoginLoadingScreen extends StatelessWidget {
  /// Whatever the parent typed on the entry screen.
  final String identifier;

  /// Which child's record to open. Already decided by this point — either
  /// the only child in the household, or the one picked from the list.
  final String childId;

  final String password;

  const LoginLoadingScreen({
    super.key,
    required this.identifier,
    required this.childId,
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
        mustChangePassword = await HouseholdService.instance.selectChild(
          identifier: identifier,
          password: password,
          childId: childId,
        );
        // First authenticated moment — send any child details captured during
        // sign-up, which had no session to be saved with at the time.
        await ProfileService.instance.flushPendingProfile();
      },
      onSuccess: (_) => mustChangePassword
          ? ChangePasswordScreen(currentPassword: password)
          : const HomeShell(),
      // Signed in — the identifier/password screens must not remain behind Home.
      clearStack: true,
      steps: _steps,
    );
  }
}

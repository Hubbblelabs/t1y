import 'package:flutter/material.dart';

import '../../l10n/strings.dart';

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

  static List<({String title, String subtitle})> get _steps => [
    (
      title: S.signingYouIn,
      subtitle: S.welcomeBackApp,
    ),
    (
      title: S.loadingHelpBook,
      subtitle: S.topicsBothLanguages,
    ),
    (
      title: S.quizzesGettingReady,
      subtitle: S.checkAsYouLearn,
    ),
    (
      title: S.almostDone,
      subtitle: S.momentMore,
    ),
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

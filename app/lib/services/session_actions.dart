import 'package:flutter/material.dart';

import '../main.dart' show rootNavigatorKey;
import '../screens/auth/get_started_screen.dart';
import '../screens/home/home_shell.dart';
import '../widgets/pin_gate.dart';
import 'auth_service.dart';
import 'household_service.dart';
import 'local_reminders.dart';
import 'profile_service.dart';

/// Leaving one child's session — signing out, or switching to a sibling —
/// done the same way from wherever it is started.
class SessionActions {
  SessionActions._();

  static Future<void> _forgetThisChild() async {
    PinSession.lock();
    await LocalReminders.cancelAll();
    await ProfileService.instance.clearCache();
  }

  static Future<void> signOut() async {
    await AuthService.instance.signOut();
    await _forgetThisChild();
    rootNavigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const GetStartedScreen()),
      (route) => false,
    );
  }

  /// Opens [childId]'s record in place of the current one. Needs the family's
  /// account password — the same check as signing in — so a child using the
  /// phone cannot hop into a sibling's record.
  static Future<void> switchToChild({
    required String childId,
    required String password,
  }) async {
    await HouseholdService.instance.selectChild(
      identifier: childId,
      password: password,
      childId: childId,
    );
    await _forgetThisChild();
    rootNavigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const HomeShell()),
      (route) => false,
    );
  }
}

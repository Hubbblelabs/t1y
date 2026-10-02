import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The guided tour of the app's main screens.
///
/// The targets live on Home (the header and the day's readings) and on the
/// bottom navigation, so the keys are shared here. The tour runs once by
/// itself the first time a family reaches Home, and again whenever they pick
/// "Take the app tour" in Settings.
class AppTour {
  AppTour._();

  // v2: the tour gained the SOS and Share-with-a-guardian steps, so everyone
  // sees it once more.
  static const _seenKey = 'app_tour_seen_v2';

  static final home = GlobalKey();
  static final language = GlobalKey();
  static final profile = GlobalKey();
  static final readings = GlobalKey();
  static final helpBookTab = GlobalKey();
  static final quizzesTab = GlobalKey();
  static final healthTab = GlobalKey();
  static final sos = GlobalKey();

  /// The "Share with a guardian" button on the Health tab.
  static final shareGuardian = GlobalKey();

  /// Bumped when Settings asks for the tour; Home listens and starts it.
  static final requests = ValueNotifier<int>(0);

  static void request() => requests.value++;

  static Future<bool> seen() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_seenKey) ?? false;
  }

  static Future<void> markSeen() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_seenKey, true);
  }
}

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

  static const _seenKey = 'app_tour_seen_v1';

  static final home = GlobalKey();
  static final language = GlobalKey();
  static final profile = GlobalKey();
  static final readings = GlobalKey();
  static final helpBookTab = GlobalKey();
  static final quizzesTab = GlobalKey();
  static final healthTab = GlobalKey();

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

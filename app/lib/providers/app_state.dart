import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Minimal app-wide state: active locale, shared by every screen. Deliberately
/// not a full state-management package (riverpod/provider) — a single
/// ChangeNotifier is enough for the one piece of state that's genuinely
/// global at this app's size.
class AppState extends ChangeNotifier {
  AppState._();
  static final AppState instance = AppState._();

  static const _localeKey = 'locale';

  String _locale = 'en';
  String get locale => _locale;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _locale = prefs.getString(_localeKey) ?? 'en';
  }

  Future<void> setLocale(String value) async {
    _locale = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localeKey, value);
    notifyListeners();
  }

  bool get isTamil => _locale == 'ta';
}

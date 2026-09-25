import 'package:shared_preferences/shared_preferences.dart';

/// Where the backend lives. Configurable at runtime (Profile screen) because
/// there is no single right answer for local development: the Android
/// emulator reaches a Mac's localhost via `10.0.2.2`, a physical device
/// needs the Mac's LAN IP, and a real deployment needs a real domain.
class ApiConfig {
  ApiConfig._();

  static const _prefsKey = 'api_base_url';

  /// Dev-time default. `10.0.2.2` only resolves on the Android *emulator* —
  /// a physical phone needs the dev machine's actual LAN IP, which changes
  /// per network. Update this (or override it from the Profile screen once
  /// signed in) to match whatever `ipconfig getifaddr en0` / `ifconfig`
  /// reports on the machine running `npm run dev`.
  static const defaultBaseUrl = 'http://192.168.29.87:3000';

  static String? _cached;

  static Future<String> getBaseUrl() async {
    if (_cached != null) return _cached!;
    final prefs = await SharedPreferences.getInstance();
    _cached = prefs.getString(_prefsKey) ?? defaultBaseUrl;
    return _cached!;
  }

  static Future<void> setBaseUrl(String url) async {
    final trimmed = url.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, trimmed);
    _cached = trimmed;
  }
}

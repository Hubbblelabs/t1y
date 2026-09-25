import 'package:shared_preferences/shared_preferences.dart';

/// Where the backend lives.
///
/// Set at build time, not typed into the app:
///
///   flutter build appbundle --release \
///     --dart-define=API_BASE_URL=https://your-api-domain
///
/// A release build for Google Play must point at an HTTPS address — release
/// builds do not allow plain HTTP (see android/app/src/debug/AndroidManifest.xml
/// for the development-only exception). Without the define, a debug build
/// falls back to the development machine's address on the local network.
class ApiConfig {
  ApiConfig._();

  static const _prefsKey = 'api_base_url';

  static const defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.29.87:3000',
  );

  static String? _cached;

  static Future<String> getBaseUrl() async {
    if (_cached != null) return _cached!;
    final prefs = await SharedPreferences.getInstance();
    // An address saved by an older build is ignored in favour of the one this
    // build was made with — otherwise a phone that once ran a development
    // build would keep talking to a laptop after updating from the Play Store.
    await prefs.remove(_prefsKey);
    _cached = defaultBaseUrl.replaceAll(RegExp(r'/+$'), '');
    return _cached!;
  }
}

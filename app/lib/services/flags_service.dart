import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

/// Flags gating clinical content (dose calculators). Any flag in this set
/// must fail-safe to `false` if the cached value is older than the server's
/// declared `maxAgeSeconds` — a cached `true` must never outlive an admin
/// switching it off. This is the client half of the contract documented in
/// api/lib/services/feature-flags.ts; the server cannot enforce it, which is
/// exactly why it has to be honoured here.
const clinicalSafetyFlagKeys = {'ic_isf_calculator', 'glucagon_dose_calculator'};

class FlagsService {
  FlagsService._();
  static final FlagsService instance = FlagsService._();

  static const _cacheKey = 'feature_flags_cache';

  Future<Map<String, bool>> getFlags({bool forceRefresh = false}) async {
    try {
      final data = await ApiClient.instance.get('/api/feature-flags');
      final flags = Map<String, bool>.from(data['data']['flags'] as Map);
      final maxAgeSeconds = data['data']['maxAgeSeconds'] as int;
      await _writeCache(flags, maxAgeSeconds);
      return flags;
    } catch (_) {
      return _readCacheWithFailSafe();
    }
  }

  Future<void> _writeCache(Map<String, bool> flags, int maxAgeSeconds) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _cacheKey,
      jsonEncode({
        'flags': flags,
        'fetchedAt': DateTime.now().toUtc().toIso8601String(),
        'maxAgeSeconds': maxAgeSeconds,
      }),
    );
  }

  Future<Map<String, bool>> _readCacheWithFailSafe() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey);
    if (raw == null) return {};

    final decoded = jsonDecode(raw) as Map<String, dynamic>;
    final flags = Map<String, bool>.from(decoded['flags'] as Map);
    final fetchedAt = DateTime.parse(decoded['fetchedAt'] as String);
    final maxAgeSeconds = decoded['maxAgeSeconds'] as int;
    final age = DateTime.now().toUtc().difference(fetchedAt).inSeconds;

    if (age > maxAgeSeconds) {
      for (final key in clinicalSafetyFlagKeys) {
        flags[key] = false;
      }
    }
    return flags;
  }
}

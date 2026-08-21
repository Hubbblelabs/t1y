import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/topic.dart';
import 'api_client.dart';

/// Fetches the education-content bundle and caches it in shared_preferences
/// so the Help Book can render from cache when offline. This is a simpler
/// stand-in for the full sqflite outbox described in the build plan — it
/// covers "read the last-downloaded content with no network" but not a
/// write-side offline queue (see quiz_service.dart for where writes still
/// need connectivity in this v1).
class ContentService {
  ContentService._();
  static final ContentService instance = ContentService._();

  String _cacheKey(String locale) => 'content_bundle_$locale';
  String _syncedAtKey(String locale) => 'content_synced_at_$locale';

  /// How often content re-syncs on its own. The curriculum is fixed for the
  /// study, so corrections are rare — a daily check is plenty, and the
  /// Profile screen's "Check for new content" covers the impatient case.
  static const syncInterval = Duration(hours: 24);

  /// Refreshes any locale whose cache is older than [syncInterval].
  /// Called on app start and resume; safe to call often — it no-ops when the
  /// cache is fresh, so it costs nothing on a phone opened twenty times a day.
  Future<void> syncIfStale({List<String> locales = const ['en', 'ta']}) async {
    final prefs = await SharedPreferences.getInstance();
    final now = DateTime.now();
    for (final locale in locales) {
      final raw = prefs.getString(_syncedAtKey(locale));
      final last = raw == null ? null : DateTime.tryParse(raw);
      if (last != null && now.difference(last) < syncInterval) continue;
      try {
        await _refresh(locale);
      } catch (_) {
        // Offline — keep the existing cache and retry on the next resume.
      }
    }
  }

  /// When the given locale's content was last successfully downloaded.
  Future<DateTime?> lastSyncedAt(String locale) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_syncedAtKey(locale));
    return raw == null ? null : DateTime.tryParse(raw);
  }

  Future<List<Topic>> getTopics(String locale, {bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await _readCache(locale);
      if (cached != null) {
        // Refresh in the background; the caller already has data to show.
        _refresh(locale);
        return cached;
      }
    }
    return _refresh(locale);
  }

  Future<List<Topic>> _refresh(String locale) async {
    try {
      final data = await ApiClient.instance.get('/api/education/bundle', query: {'locale': locale});
      final items = (data['data']['items'] as List)
          .map((t) => Topic.fromJson(t as Map<String, dynamic>))
          .toList();
      await _writeCache(locale, items);
      return items;
    } catch (e) {
      final cached = await _readCache(locale);
      if (cached != null) return cached;
      rethrow;
    }
  }

  Future<List<Topic>?> _readCache(String locale) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey(locale));
    if (raw == null) return null;
    final list = jsonDecode(raw) as List;
    return list.map((t) => Topic.fromJson(t as Map<String, dynamic>)).toList();
  }

  Future<void> _writeCache(String locale, List<Topic> topics) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cacheKey(locale), jsonEncode(topics.map((t) => t.toJson()).toList()));
    await prefs.setString(_syncedAtKey(locale), DateTime.now().toIso8601String());
  }
}

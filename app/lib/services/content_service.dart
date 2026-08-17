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
  }
}

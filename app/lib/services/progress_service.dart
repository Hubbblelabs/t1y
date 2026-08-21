import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';

/// Topic reading progress.
///
/// The backend is the source of truth (`GET /api/progress`), but writes go
/// through the offline outbox: every "opened"/"completed" event is queued
/// locally with a client-generated UUID and flushed to `POST /api/sync`,
/// which deduplicates on that id. That means a topic read on a train with no
/// signal still counts once the phone reconnects, and a retried flush can
/// never double-count it.
class ProgressService {
  ProgressService._();
  static final ProgressService instance = ProgressService._();

  static const _outboxKey = 'sync_outbox';
  static const _readCacheKey = 'progress_read_slugs';
  static const _uuid = Uuid();

  /// Slugs of topics the participant has completed, server-truth where
  /// available and last-known cache otherwise.
  Future<Set<String>> readTopicSlugs() async {
    try {
      final data = await ApiClient.instance.get('/api/progress');
      final topics = (data['data']['topics'] as List?) ?? const [];
      final slugs = topics
          .where((t) => (t as Map)['completedAt'] != null)
          .map((t) => (t as Map)['topicSlug'] as String)
          .toSet();
      await _writeReadCache(slugs);
      return slugs;
    } catch (_) {
      return _readCache();
    }
  }

  /// Full progress payload (topics + quiz attempts) for the dashboard.
  /// Returns null when offline with nothing cached.
  Future<Map<String, dynamic>?> fetchProgress() async {
    try {
      final data = await ApiClient.instance.get('/api/progress');
      return data['data'] as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> recordTopicOpened(String topicSlug, String locale) =>
      _enqueue('TOPIC_OPEN', {'topicSlug': topicSlug, 'locale': locale.toUpperCase()});

  Future<void> recordTopicCompleted(
    String topicSlug,
    String locale, {
    int secondsSpent = 0,
  }) async {
    await _enqueue('TOPIC_COMPLETION', {
      'topicSlug': topicSlug,
      'locale': locale.toUpperCase(),
      'secondsSpent': secondsSpent,
    });
    // Optimistically reflect it locally so the Help Book updates even if the
    // flush hasn't landed yet.
    final cached = await _readCache();
    cached.add(topicSlug);
    await _writeReadCache(cached);
  }

  Future<void> _enqueue(String type, Map<String, dynamic> payload) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_outboxKey) ?? [];
    raw.add(jsonEncode({
      'clientId': _uuid.v4(),
      'type': type,
      'occurredAt': DateTime.now().toUtc().toIso8601String(),
      'payload': payload,
    }));
    await prefs.setStringList(_outboxKey, raw);
    // Best-effort immediate flush; failures just leave the item queued.
    unawaited(flush());
  }

  /// Pushes queued events. Events the server accepted are dropped from the
  /// outbox; anything left (network failure) stays queued for the next flush.
  Future<void> flush() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_outboxKey) ?? [];
    if (raw.isEmpty) return;

    // The sync endpoint caps a batch at 100 events.
    final batch = raw.take(100).toList();
    final events = batch.map((e) => jsonDecode(e) as Map<String, dynamic>).toList();

    try {
      await ApiClient.instance.post('/api/sync', body: {'events': events});
      final remaining = raw.sublist(batch.length);
      await prefs.setStringList(_outboxKey, remaining);
    } catch (_) {
      // Stay queued — flushed on the next app resume or sync tick.
    }
  }

  Future<int> pendingCount() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_outboxKey) ?? []).length;
  }

  Future<Set<String>> _readCache() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_readCacheKey) ?? []).toSet();
  }

  Future<void> _writeReadCache(Set<String> slugs) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_readCacheKey, slugs.toList());
  }
}

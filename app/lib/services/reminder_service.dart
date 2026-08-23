import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

class Reminder {
  final String id;
  final String type;
  final String title;
  final String? body;
  final String? timeOfDay;
  final String recurrence;
  final bool enabled;
  final DateTime? nextTriggerAt;

  Reminder({
    required this.id,
    required this.type,
    required this.title,
    required this.recurrence,
    required this.enabled,
    this.body,
    this.timeOfDay,
    this.nextTriggerAt,
  });

  factory Reminder.fromJson(Map<String, dynamic> j) => Reminder(
    id: j['id'] as String,
    type: j['type'] as String? ?? 'GENERAL',
    title: j['title'] as String? ?? '',
    body: j['body'] as String?,
    timeOfDay: j['timeOfDay'] as String?,
    recurrence: j['recurrence'] as String? ?? 'DAILY',
    enabled: j['enabled'] as bool? ?? true,
    nextTriggerAt: j['nextTriggerAt'] == null
        ? null
        : DateTime.tryParse(j['nextTriggerAt'] as String),
  );

  Reminder withNextTrigger(DateTime at) => Reminder(
    id: id,
    type: type,
    title: title,
    body: body,
    timeOfDay: timeOfDay,
    recurrence: recurrence,
    enabled: enabled,
    nextTriggerAt: at,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type,
    'title': title,
    'body': body,
    'timeOfDay': timeOfDay,
    'recurrence': recurrence,
    'enabled': enabled,
    'nextTriggerAt': nextTriggerAt?.toIso8601String(),
  };
}

/// Reminder schedules.
///
/// The backend owns recurrence and the next firing time (see
/// `api/app/api/reminders/route.ts`); this only reads and renders them.
///
/// Note on scope: reminders currently surface *in-app* only. Actual push
/// delivery is not wired — the backend's cron creates Notification rows but
/// nothing sends them to a device, and `DeviceToken` is written but never
/// read (documented in api/docs/UNUSED-BACKEND.md). So a parent sees their
/// upcoming reminders when they open the app; they are not yet buzzed by it.
class ReminderService {
  ReminderService._();
  static final ReminderService instance = ReminderService._();

  static const _cacheKey = 'reminders_cache';

  Future<List<Reminder>> list({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await _readCache();
      if (cached != null) {
        _refresh();
        return cached;
      }
    }
    return await _refresh() ?? [];
  }

  /// Reminders due in the next [within], soonest first — what the Home
  /// dashboard shows.
  ///
  /// `nextTriggerAt` is computed by the backend's reminder cron, which is
  /// registered as a Vercel Cron and therefore never fires in local or
  /// self-hosted development — every reminder comes back with a null
  /// `nextTriggerAt`. Filtering on it alone showed an empty list and made
  /// reminders look broken, so a DAILY reminder's next occurrence is derived
  /// here from `timeOfDay` when the server hasn't supplied one.
  ///
  /// This is display-only. The server stays authoritative for actual firing.
  Future<List<Reminder>> upcoming({Duration within = const Duration(days: 7)}) async {
    final all = await list();
    final now = DateTime.now();
    final cutoff = now.add(within);

    final due = <(DateTime, Reminder)>[];
    for (final r in all.where((r) => r.enabled)) {
      final at = r.nextTriggerAt ?? _deriveNextTrigger(r, now);
      if (at == null || at.isAfter(cutoff)) continue;
      due.add((at, r));
    }
    due.sort((a, b) => a.$1.compareTo(b.$1));
    return due.map((e) => e.$2.withNextTrigger(e.$1)).toList();
  }

  /// Next occurrence of a "HH:mm" daily reminder, in device-local time.
  /// Returns null for recurrences that need server-side rules (weekly,
  /// monthly) rather than guessing at them.
  static DateTime? _deriveNextTrigger(Reminder r, DateTime now) {
    final time = r.timeOfDay;
    if (time == null || r.recurrence != 'DAILY') return null;
    final parts = time.split(':');
    if (parts.length < 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;

    var next = DateTime(now.year, now.month, now.day, hour, minute);
    if (!next.isAfter(now)) next = next.add(const Duration(days: 1));
    return next;
  }

  Future<List<Reminder>?> _refresh() async {
    try {
      final data = await ApiClient.instance.get('/api/reminders');
      final raw = data['data'];
      final list = (raw is List ? raw : (raw['items'] as List? ?? const []));
      final items = list
          .map((r) => Reminder.fromJson(r as Map<String, dynamic>))
          .toList();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _cacheKey,
        jsonEncode(items.map((r) => r.toJson()).toList()),
      );
      return items;
    } catch (_) {
      return _readCache();
    }
  }

  Future<List<Reminder>?> _readCache() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey);
    if (raw == null) return null;
    return (jsonDecode(raw) as List)
        .map((r) => Reminder.fromJson(r as Map<String, dynamic>))
        .toList();
  }
}

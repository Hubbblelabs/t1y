import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../l10n/strings.dart';
import '../models/health_config.dart';

/// Reminders shown by the phone itself.
///
/// After every glucose reading the app schedules one reminder for six hours
/// later — the same gap after which the study counts a family as overdue (see
/// api/lib/services/glucose-reminders.ts). A new reading replaces it, so a
/// family who keeps logging never sees one. Done on the device so it works
/// without a push-notification service and without a connection.
///
/// Off until the parent turns Reminders on in Settings and allows
/// notifications when the phone asks.
class LocalReminders {
  LocalReminders._();

  static const _enabledKey = 'notifications_enabled';
  static const _glucoseReminderId = 1001;
  static const gap = Duration(hours: 6);

  // Repeating reminders from the child's health-data configuration. Each gets
  // a block of ids so a fresh sync can cancel exactly the previous batch.
  static const _insulinBaseId = 2000;
  static const _exerciseBaseId = 3000;
  static const _blockSize = 100;
  static const _detailsReminderId = 4001;

  /// How far ahead repeating reminders are queued. The phone has no
  /// "every N hours from now" repeat, so a window of upcoming ones is
  /// scheduled and topped up every time the app opens or refreshes.
  static const _horizon = Duration(hours: 48);

  /// iOS keeps at most 64 scheduled notifications in total, so each repeating
  /// kind is capped well under that (insulin + exercise + the one-offs).
  static const _maxPerKind = 24;

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  static Future<void> _init() async {
    if (_ready || kIsWeb) return;
    tz_data.initializeTimeZones();
    try {
      final local = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(local.identifier));
    } catch (_) {
      tz.setLocalLocation(tz.getLocation('Asia/Kolkata'));
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        // Asked for from Settings, at the moment the parent turns reminders
        // on — never on first launch.
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    _ready = true;
  }

  static Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? false;
  }

  /// Shows the phone's own "allow notifications?" prompt. True when allowed.
  static Future<bool> requestPermission() async {
    await _init();
    if (defaultTargetPlatform == TargetPlatform.android) {
      final android = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      final granted = await android?.requestNotificationsPermission();
      return granted ?? await android?.areNotificationsEnabled() ?? false;
    }
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final ios = _plugin
          .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin
          >();
      return await ios?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          ) ??
          false;
    }
    return false;
  }

  static Future<void> setEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, value);
    if (!value) await cancelAll();
  }

  /// Schedules the next "time to check glucose" reminder, six hours after
  /// [lastReading] (or soon, if that has already passed). Does nothing unless
  /// reminders are on.
  static Future<void> scheduleAfter(DateTime? lastReading) async {
    if (kIsWeb || !await isEnabled()) return;
    try {
      await _init();
      final now = DateTime.now();
      var at = (lastReading ?? now).add(gap);
      if (at.isBefore(now.add(const Duration(minutes: 15)))) {
        at = now.add(const Duration(minutes: 15));
      }
      await _plugin.cancel(id: _glucoseReminderId);
      await _plugin.zonedSchedule(
        id: _glucoseReminderId,
        title: S.reminderTitle,
        body: S.reminderBody,
        scheduledDate: tz.TZDateTime.from(at, tz.local),
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            'glucose_reminders',
            S.reminders,
            channelDescription: S.remindersSubtitle,
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        // Inexact on purpose: no special alarm permission is needed, and a
        // reminder a few minutes late is fine.
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    } catch (_) {
      // A reminder that cannot be scheduled must never stop a reading being
      // saved.
    }
  }

  /// Replaces the insulin and exercise reminders with ones matching [config]:
  /// one every `insulinIntervalHours` / `exerciseReminderHours` for the next
  /// [_horizon]. Called on every app open and refresh, so editing the hours in
  /// the admin dashboard takes effect the next time the family opens the app.
  /// Does nothing unless reminders are on.
  static Future<void> scheduleConfigured(HealthConfig config) async {
    if (kIsWeb || !await isEnabled()) return;
    try {
      await _init();
      await _repeating(
        baseId: _insulinBaseId,
        everyHours: config.insulinIntervalHours,
        title: S.insulinReminderTitle,
        body: S.insulinReminderBody,
        channel: 'insulin_reminders',
        channelName: S.insulin,
      );
      await _repeating(
        baseId: _exerciseBaseId,
        everyHours: config.exerciseEnabled
            ? config.exerciseReminderHours
            : null,
        title: S.exerciseReminderTitle,
        body: S.exerciseReminderBody,
        channel: 'exercise_reminders',
        channelName: S.exercise,
      );
    } catch (_) {
      // A reminder that cannot be scheduled must never break the screen.
    }
  }

  static Future<void> _repeating({
    required int baseId,
    required int? everyHours,
    required String title,
    required String body,
    required String channel,
    required String channelName,
  }) async {
    for (var i = 0; i < _blockSize; i++) {
      await _plugin.cancel(id: baseId + i);
    }
    if (everyHours == null || everyHours < 1) return;

    final now = DateTime.now();
    final step = Duration(hours: everyHours);
    final count = (_horizon.inMinutes / step.inMinutes).floor().clamp(
      1,
      _maxPerKind,
    );
    for (var i = 1; i <= count; i++) {
      await _plugin.zonedSchedule(
        id: baseId + i - 1,
        title: title,
        body: body,
        scheduledDate: tz.TZDateTime.from(now.add(step * i), tz.local),
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            channel,
            channelName,
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
    }
  }

  /// The daily "please complete your child's details" reminder, at 6 PM.
  /// Scheduled while the details are still missing and cancelled once they are
  /// complete. Does nothing unless Reminders are on.
  static Future<void> syncDetailsReminder({required bool due}) async {
    if (kIsWeb) return;
    try {
      await _init();
      await _plugin.cancel(id: _detailsReminderId);
      if (!due || !await isEnabled()) return;
      final now = tz.TZDateTime.now(tz.local);
      var at = tz.TZDateTime(tz.local, now.year, now.month, now.day, 18);
      if (!at.isAfter(now)) at = at.add(const Duration(days: 1));
      await _plugin.zonedSchedule(
        id: _detailsReminderId,
        title: S.detailsReminderTitle,
        body: S.detailsReminderBody,
        scheduledDate: at,
        notificationDetails: NotificationDetails(
          android: AndroidNotificationDetails(
            'details_reminders',
            S.detailsDueTitle,
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        // Same time every day until cancelled.
        matchDateTimeComponents: DateTimeComponents.time,
      );
    } catch (_) {
      // A reminder that cannot be scheduled must never break the screen.
    }
  }

  static Future<void> cancelAll() async {
    if (kIsWeb) return;
    try {
      await _init();
      await _plugin.cancelAll();
    } catch (_) {}
  }
}

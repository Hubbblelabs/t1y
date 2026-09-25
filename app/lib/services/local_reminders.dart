import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../l10n/strings.dart';

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

  static Future<void> cancelAll() async {
    if (kIsWeb) return;
    try {
      await _init();
      await _plugin.cancelAll();
    } catch (_) {}
  }
}

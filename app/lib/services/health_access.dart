import 'dart:async';

import '../models/health_config.dart';
import 'flags_service.dart';
import 'local_reminders.dart';
import 'participant_features.dart';
import 'profile_service.dart';

/// Which of glucose, insulin and carbohydrates this family can record right
/// now — the study's own switches and this child's enrolment, together.
class HealthAccess {
  final bool glucose;
  final bool insulin;
  final bool carbs;
  final bool exercise;

  /// The glucose checks this child is asked for, and the reminder hours.
  final HealthConfig config;

  const HealthAccess({
    required this.glucose,
    required this.insulin,
    required this.carbs,
    this.exercise = false,
    this.config = HealthConfig.defaults,
  });

  static const all = HealthAccess(glucose: true, insulin: true, carbs: true);

  bool get anything => glucose || insulin || carbs || exercise;

  /// Reads the account's enrolled features and the study-wide carbohydrate
  /// flag. Anything that cannot be read (offline, say) is treated as on: the
  /// server still refuses a write that is not allowed, and a screen that
  /// hides everything because the phone lost signal helps nobody.
  static Future<HealthAccess> load() async {
    // Straight from the server (the saved copy only when offline), so a change
    // made in the admin dashboard shows up the next time the app opens or is
    // refreshed rather than a visit later.
    final me = await ProfileService.instance
        .me(forceRefresh: true)
        .catchError((_) => null);
    final features = enabledFeaturesFrom(me);
    final flags = await FlagsService.instance.getFlags().catchError(
      (_) => <String, bool>{},
    );
    final config = HealthConfig.fromProfile(
      me?['profile'] as Map<String, dynamic>?,
    );
    // Keep the phone's insulin and exercise reminders on the hours set in the
    // dashboard. Not awaited: a slow notification plugin must not hold up the
    // screen, and it already swallows its own failures.
    unawaited(LocalReminders.scheduleConfigured(config));
    return HealthAccess(
      config: config,
      exercise: config.exerciseEnabled,
      // Nothing to ask for when a coordinator has turned every glucose check off.
      glucose:
          features.contains(kGlucoseLogging) && config.glucoseSlots.isNotEmpty,
      insulin: features.contains(kInsulinLogging),
      carbs:
          features.contains(kCarbLogging) &&
          (flags['carb_logging_enabled'] ?? true),
    );
  }
}

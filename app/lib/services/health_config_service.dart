import '../models/health_config.dart';
import 'local_reminders.dart';
import 'profile_service.dart';

/// Reads this child's health-data configuration and keeps the phone's
/// repeating reminders in step with it.
class HealthConfigService {
  HealthConfigService._();
  static final HealthConfigService instance = HealthConfigService._();

  /// The configuration as it stands on the server. Always asks the server
  /// first, so a change made in the admin dashboard shows up the next time the
  /// app opens or refreshes; falls back to the saved copy when offline.
  Future<HealthConfig> load({bool forceRefresh = true}) async {
    final me = await ProfileService.instance
        .me(forceRefresh: forceRefresh)
        .catchError((_) => null);
    return HealthConfig.fromProfile(me?['profile'] as Map<String, dynamic>?);
  }

  /// Re-reads the configuration and re-schedules the insulin and exercise
  /// reminders from it. Called whenever the app opens or is refreshed, so the
  /// hours the phone is using are always the ones set in the dashboard.
  Future<HealthConfig> syncReminders() async {
    final config = await load();
    await LocalReminders.scheduleConfigured(config);
    return config;
  }
}

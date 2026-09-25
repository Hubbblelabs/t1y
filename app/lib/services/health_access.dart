import 'flags_service.dart';
import 'participant_features.dart';
import 'profile_service.dart';

/// Which of glucose, insulin and carbohydrates this family can record right
/// now — the study's own switches and this child's enrolment, together.
class HealthAccess {
  final bool glucose;
  final bool insulin;
  final bool carbs;

  const HealthAccess({
    required this.glucose,
    required this.insulin,
    required this.carbs,
  });

  static const all = HealthAccess(glucose: true, insulin: true, carbs: true);

  bool get anything => glucose || insulin || carbs;

  /// Reads the account's enrolled features and the study-wide carbohydrate
  /// flag. Anything that cannot be read (offline, say) is treated as on: the
  /// server still refuses a write that is not allowed, and a screen that
  /// hides everything because the phone lost signal helps nobody.
  static Future<HealthAccess> load() async {
    final me = await ProfileService.instance.me().catchError((_) => null);
    final features = enabledFeaturesFrom(me);
    final flags = await FlagsService.instance.getFlags().catchError(
      (_) => <String, bool>{},
    );
    return HealthAccess(
      glucose: features.contains(kGlucoseLogging),
      insulin: features.contains(kInsulinLogging),
      carbs:
          features.contains(kCarbLogging) &&
          (flags['carb_logging_enabled'] ?? true),
    );
  }
}

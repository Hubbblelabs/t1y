/// The six glucose checks a day can ask for — mirrors `GlucoseSlot` in
/// api/prisma/schema.prisma and api/lib/health-data-config.ts.
enum GlucoseSlot {
  preBreakfast('PRE_BREAKFAST'),
  postBreakfast('POST_BREAKFAST'),
  preLunch('PRE_LUNCH'),
  postLunch('POST_LUNCH'),
  preDinner('PRE_DINNER'),
  postDinner('POST_DINNER');

  final String apiValue;
  const GlucoseSlot(this.apiValue);

  static GlucoseSlot? fromApi(String? value) {
    for (final s in GlucoseSlot.values) {
      if (s.apiValue == value) return s;
    }
    return null;
  }
}

/// What this child's coordinator has asked the family to record — set in the
/// admin dashboard under Health data configuration and carried in
/// `profile` on `/api/users/me`.
class HealthConfig {
  final List<GlucoseSlot> glucoseSlots;

  /// Hours between insulin doses (24 = once a day, 12 = twice a day).
  /// Null means no insulin reminder.
  final int? insulinIntervalHours;
  final bool exerciseEnabled;
  final int? exerciseReminderHours;

  const HealthConfig({
    required this.glucoseSlots,
    this.insulinIntervalHours,
    this.exerciseEnabled = false,
    this.exerciseReminderHours,
  });

  /// Used when nothing can be read (offline on first launch, an older server):
  /// every glucose check on and no reminders, which is how the app behaved
  /// before this was configurable.
  static const defaults = HealthConfig(glucoseSlots: GlucoseSlot.values);

  factory HealthConfig.fromProfile(Map<String, dynamic>? profile) {
    if (profile == null) return defaults;
    final rawSlots = profile['glucoseSlots'];
    return HealthConfig(
      glucoseSlots: rawSlots is List
          ? [
              for (final s in GlucoseSlot.values)
                if (rawSlots.contains(s.apiValue)) s,
            ]
          : GlucoseSlot.values,
      insulinIntervalHours: (profile['insulinIntervalHours'] as num?)?.toInt(),
      exerciseEnabled: profile['exerciseEnabled'] as bool? ?? false,
      exerciseReminderHours: (profile['exerciseReminderHours'] as num?)
          ?.toInt(),
    );
  }
}

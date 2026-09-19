import '../models/glucose_reading.dart';
import 'api_client.dart';

/// Whether a parent may record another reading right now, from
/// `GET /api/glucose/status`.
///
/// The cooldown length is admin-configurable (Settings → Glucose entry on
/// the backend), not fixed in the app — this is always the server's current
/// answer, never a value computed on-device.
class GlucoseEntryStatus {
  final int cooldownHours;
  final DateTime? lastReadingAt;
  final DateTime? nextAllowedAt;
  final bool canEnterNow;

  const GlucoseEntryStatus({
    required this.cooldownHours,
    required this.lastReadingAt,
    required this.nextAllowedAt,
    required this.canEnterNow,
  });

  factory GlucoseEntryStatus.fromJson(Map<String, dynamic> json) => GlucoseEntryStatus(
    cooldownHours: json['cooldownHours'] as int? ?? 8,
    lastReadingAt: json['lastReadingAt'] == null
        ? null
        : DateTime.tryParse(json['lastReadingAt'] as String)?.toLocal(),
    nextAllowedAt: json['nextAllowedAt'] == null
        ? null
        : DateTime.tryParse(json['nextAllowedAt'] as String)?.toLocal(),
    canEnterNow: json['canEnterNow'] as bool? ?? true,
  );
}

/// Glucometer readings entered by the parent.
///
/// Both endpoints are gated server-side by the `health_logging_enabled`
/// feature flag, which defaults to **off**: this study's ethics approval
/// covers an education app, and collecting glucose readings is a separate
/// question for the ethics committee (see api/docs/UNUSED-BACKEND.md). Until
/// a coordinator enables it, [create] returns 403 and the entry screen shows
/// that plainly rather than failing in a way a parent would read as a bug.
class GlucoseService {
  GlucoseService._();
  static final GlucoseService instance = GlucoseService._();

  /// Whether a reading may be recorded right now, and when next if not.
  /// Read before showing the entry form, so the cooldown reads as "next
  /// reading at 6:00 PM" rather than a rejected save.
  Future<GlucoseEntryStatus> status() async {
    final data = await ApiClient.instance.get('/api/glucose/status');
    return GlucoseEntryStatus.fromJson(data['data'] as Map<String, dynamic>);
  }

  /// Readings for the log, newest or oldest first per [newestFirst], and
  /// optionally restricted to one calendar day ([onDate]) for the date filter.
  Future<List<GlucoseReading>> recent({
    int limit = 100,
    bool newestFirst = true,
    DateTime? onDate,
  }) async {
    final query = {
      'pageSize': '$limit',
      'sortOrder': newestFirst ? 'desc' : 'asc',
      // Default range is 30 days server-side; a log with no date filter
      // set should still show everything, not silently drop older entries.
      'range': 'all',
    };
    if (onDate != null) {
      final dayStart = DateTime(onDate.year, onDate.month, onDate.day);
      final dayEnd = dayStart.add(const Duration(days: 1));
      // The API only accepts from/to alongside range=custom — a bare pair
      // is rejected as a validation error, not silently accepted.
      query['range'] = 'custom';
      query['from'] = dayStart.toUtc().toIso8601String();
      query['to'] = dayEnd.toUtc().toIso8601String();
    }
    final data = await ApiClient.instance.get('/api/glucose', query: query);
    return (data['data'] as List<dynamic>)
        .map((r) => GlucoseReading.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  /// Records a reading taken right now. No context tag and no backdating —
  /// a parent reads the meter and enters the number, nothing else.
  Future<GlucoseReading> create(double value) async {
    final data = await ApiClient.instance.post(
      '/api/glucose',
      body: {
        'value': value,
        'unit': 'MG_DL',
        'context': GlucoseContext.random.apiValue,
        'measuredAt': DateTime.now().toUtc().toIso8601String(),
      },
    );
    return GlucoseReading.fromJson(data['data'] as Map<String, dynamic>);
  }
}

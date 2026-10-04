import '../models/glucose_reading.dart';
import '../models/health_config.dart';
import 'api_client.dart';

/// Glucometer readings entered by the parent.
///
/// Both endpoints are gated server-side by the `health_logging_enabled`
/// feature flag, which defaults to **off**: this study's ethics approval
/// covers an education app, and collecting glucose readings is a separate
/// question for the ethics committee (see api/docs/UNUSED-BACKEND.md). Until
/// a coordinator enables it, [create] returns 403 and the entry screen shows
/// that plainly rather than failing in a way a parent would read as a bug.
/// One day's average glucose, for the progress graph.
class DailyGlucose {
  final DateTime day;
  final double average;
  final int count;
  const DailyGlucose(this.day, this.average, this.count);
}

class GlucoseService {
  GlucoseService._();
  static final GlucoseService instance = GlucoseService._();

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

  /// Records a reading taken right now. No backdating — a parent reads the
  /// meter and enters the number, and says which of the day's checks it is
  /// ([slot]) when the child has scheduled ones.
  Future<GlucoseReading> create(double value, {GlucoseSlot? slot}) async {
    final data = await ApiClient.instance.post(
      '/api/glucose',
      body: {
        'value': value,
        'unit': 'MG_DL',
        'context': GlucoseContext.random.apiValue,
        if (slot != null) 'slot': slot.apiValue,
        'measuredAt': DateTime.now().toUtc().toIso8601String(),
      },
    );
    return GlucoseReading.fromJson(data['data'] as Map<String, dynamic>);
  }

  /// Every day with readings, oldest first, as daily averages — from the
  /// first reading ever recorded to today. Computed by the server, so it is
  /// always current.
  Future<List<DailyGlucose>> dailyAverages() async {
    final data = await ApiClient.instance.get(
      '/api/glucose/trends',
      query: {'interval': 'day', 'range': 'all', 'unit': 'MG_DL'},
    );
    final series = (data['data'] as Map<String, dynamic>)['series'] as List;
    final days = <DailyGlucose>[];
    for (final row in series) {
      final map = row as Map<String, dynamic>;
      final avg = (map['average'] as num?)?.toDouble();
      if (avg == null) continue;
      final at = DateTime.parse(map['bucket'] as String).toLocal();
      days.add(
        DailyGlucose(
          DateTime(at.year, at.month, at.day),
          avg,
          (map['count'] as num?)?.toInt() ?? 1,
        ),
      );
    }
    return days;
  }
}

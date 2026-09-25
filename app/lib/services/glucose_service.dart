import '../models/glucose_reading.dart';
import 'api_client.dart';

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

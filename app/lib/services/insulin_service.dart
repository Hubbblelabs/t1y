import 'api_client.dart';

/// One recorded insulin dose.
class InsulinDose {
  final String id;
  final String name;

  /// `RAPID_ACTING`, `SHORT_ACTING`, `INTERMEDIATE_ACTING`, `LONG_ACTING`,
  /// `PREMIXED` or `OTHER`.
  final String type;
  final double units;
  final DateTime administeredAt;

  const InsulinDose({
    required this.id,
    required this.name,
    required this.type,
    required this.units,
    required this.administeredAt,
  });

  factory InsulinDose.fromJson(Map<String, dynamic> json) => InsulinDose(
    id: json['id'] as String,
    name: json['insulinName'] as String? ?? '',
    type: json['insulinType'] as String? ?? 'OTHER',
    units: (json['doseUnits'] as num).toDouble(),
    administeredAt: DateTime.parse(json['administeredAt'] as String).toLocal(),
  );
}

/// What was given, as reported by the parent.
///
/// This records; it never recommends. The server has no dose calculation and
/// this has none either — anything that suggests an amount lives in the
/// calculators, which show their working and carry a clinician-confirmation
/// note.
///
/// Gated on the server by the `health_logging_enabled` flag, like glucose.
class InsulinService {
  InsulinService._();
  static final InsulinService instance = InsulinService._();

  /// The most recent doses, newest first.
  Future<List<InsulinDose>> recent({int limit = 30}) async {
    final data = await ApiClient.instance.get(
      '/api/insulin',
      query: {'pageSize': '$limit', 'sortOrder': 'desc'},
    );
    return [
      for (final row in data['data'] as List<dynamic>)
        InsulinDose.fromJson(row as Map<String, dynamic>),
    ];
  }

  Future<void> record({
    required String name,
    required String type,
    required double units,
    required DateTime administeredAt,
  }) async {
    await ApiClient.instance.post(
      '/api/insulin',
      body: {
        'insulinName': name,
        'insulinType': type,
        'doseUnits': units,
        'administeredAt': administeredAt.toUtc().toIso8601String(),
      },
    );
  }

  /// Total units given on the calendar day of [day] (local time).
  static double totalOn(DateTime day, List<InsulinDose> doses) => doses
      .where(
        (d) =>
            d.administeredAt.year == day.year &&
            d.administeredAt.month == day.month &&
            d.administeredAt.day == day.day,
      )
      .fold(0.0, (sum, d) => sum + d.units);
}

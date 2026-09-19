/// When a reading was taken relative to eating — mirrors `GlucoseContext` in
/// api/prisma/schema.prisma. The label is what the parent picks from; the
/// [name] is what the API expects.
enum GlucoseContext {
  fasting('FASTING', 'Fasting'),
  preMeal('PRE_MEAL', 'Before meal'),
  postMeal('POST_MEAL', 'After meal'),
  bedtime('BEDTIME', 'Bedtime'),
  random('RANDOM', 'Random');

  final String apiValue;
  final String label;
  const GlucoseContext(this.apiValue, this.label);

  static GlucoseContext fromApi(String? value) => GlucoseContext.values.firstWhere(
    (c) => c.apiValue == value,
    orElse: () => GlucoseContext.random,
  );
}

/// One glucometer reading, entered by the parent.
class GlucoseReading {
  final String id;

  /// Always mg/dL in this study — the app doesn't offer mmol/L, so no unit
  /// conversion happens anywhere on the client.
  final double value;
  final GlucoseContext context;
  final DateTime measuredAt;
  final String? notes;

  const GlucoseReading({
    required this.id,
    required this.value,
    required this.context,
    required this.measuredAt,
    this.notes,
  });

  factory GlucoseReading.fromJson(Map<String, dynamic> json) => GlucoseReading(
    id: json['id'] as String,
    value: (json['value'] as num).toDouble(),
    context: GlucoseContext.fromApi(json['context'] as String?),
    measuredAt:
        DateTime.tryParse(json['measuredAt'] as String? ?? '')?.toLocal() ??
        DateTime.now(),
    notes: json['notes'] as String?,
  );

  /// Plain-language band for the reading, used only to colour the entry and
  /// label it in the list.
  ///
  /// These are the widely-taught general paediatric targets, NOT personal
  /// clinical advice: a child's own targets are set by their diabetes team
  /// and can differ. The UI says so wherever this is shown — the app must
  /// never look like it is telling a family what to do about a number.
  GlucoseBand get band {
    if (value < 70) return GlucoseBand.low;
    if (value > 180) return GlucoseBand.high;
    return GlucoseBand.inRange;
  }
}

enum GlucoseBand { low, inRange, high }

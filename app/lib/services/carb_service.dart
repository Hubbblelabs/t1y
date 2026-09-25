import 'api_client.dart';

/// One recorded meal's carbohydrates.
///
/// This is a deliberately small slice of the backend's `Meal` record — just
/// what this app collects: how many grams, of what kind of meal, and when.
/// The record can hold far more (individual food items, calories, a photo),
/// none of which this app asks a parent to fill in.
class CarbEntry {
  final String id;
  final String mealType;
  final double? carbsGrams;
  final DateTime consumedAt;
  final String? notes;

  const CarbEntry({
    required this.id,
    required this.mealType,
    required this.carbsGrams,
    required this.consumedAt,
    this.notes,
  });

  factory CarbEntry.fromJson(Map<String, dynamic> json) => CarbEntry(
    id: json['id'] as String,
    mealType: json['mealType'] as String? ?? 'OTHER',
    carbsGrams: (json['totalCarbsGrams'] as num?)?.toDouble(),
    consumedAt: DateTime.parse(json['consumedAt'] as String).toLocal(),
    notes: json['notes'] as String?,
  );
}

/// Carbohydrates eaten, as reported by the parent.
///
/// This records; it never recommends — the same rule glucose and insulin
/// logging follow. Gated on the server by the `health_logging_enabled` flag
/// and by this child's own `CARB_LOGGING` eligibility.
class CarbService {
  CarbService._();
  static final CarbService instance = CarbService._();

  /// The most recent entries, newest first.
  Future<List<CarbEntry>> recent({int limit = 30}) async {
    final data = await ApiClient.instance.get(
      '/api/meals',
      query: {'pageSize': '$limit', 'sortOrder': 'desc'},
    );
    return [
      for (final row in data['data'] as List<dynamic>)
        CarbEntry.fromJson(row as Map<String, dynamic>),
    ];
  }

  /// Families no longer pick breakfast/lunch/dinner — they log carbohydrates
  /// whenever the child eats — so the meal type is sent as `OTHER`.
  Future<void> record({
    required double carbsGrams,
    required DateTime consumedAt,
    String mealType = 'OTHER',
    String? notes,
  }) async {
    await ApiClient.instance.post(
      '/api/meals',
      body: {
        'mealType': mealType,
        'consumedAt': consumedAt.toUtc().toIso8601String(),
        'totalCarbsGrams': carbsGrams,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
  }

  /// Total grams logged on the calendar day of [day] (local time).
  static double totalOn(DateTime day, List<CarbEntry> entries) => entries
      .where(
        (e) =>
            e.consumedAt.year == day.year &&
            e.consumedAt.month == day.month &&
            e.consumedAt.day == day.day,
      )
      .fold(0.0, (sum, e) => sum + (e.carbsGrams ?? 0));
}

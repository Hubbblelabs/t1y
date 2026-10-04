import 'api_client.dart';

/// One recorded exercise session.
class ExerciseEntry {
  final String id;
  final int durationMinutes;
  final DateTime performedAt;

  /// Set when a guardian entered this through a shared link.
  final String? enteredBy;

  const ExerciseEntry({
    required this.id,
    required this.durationMinutes,
    required this.performedAt,
    this.enteredBy,
  });

  factory ExerciseEntry.fromJson(Map<String, dynamic> json) => ExerciseEntry(
    id: json['id'] as String,
    durationMinutes: (json['durationMinutes'] as num).toInt(),
    performedAt: DateTime.parse(json['performedAt'] as String).toLocal(),
    enteredBy: json['enteredBy'] as String?,
  );
}

/// Exercise the child did, as reported by the parent. Only available to a
/// child a coordinator has asked to record exercise; the server refuses it
/// otherwise.
class ExerciseService {
  ExerciseService._();
  static final ExerciseService instance = ExerciseService._();

  Future<List<ExerciseEntry>> recent({int limit = 30}) async {
    final data = await ApiClient.instance.get(
      '/api/exercises',
      query: {'pageSize': '$limit', 'sortOrder': 'desc', 'range': 'all'},
    );
    return [
      for (final row in data['data'] as List<dynamic>)
        ExerciseEntry.fromJson(row as Map<String, dynamic>),
    ];
  }

  /// Only how long and when matter, so the activity is a plain "Exercise".
  Future<void> record({
    required int minutes,
    required DateTime performedAt,
  }) async {
    await ApiClient.instance.post(
      '/api/exercises',
      body: {
        'activityName': 'Exercise',
        'category': 'OTHER',
        'durationMinutes': minutes,
        'performedAt': performedAt.toUtc().toIso8601String(),
      },
    );
  }
}

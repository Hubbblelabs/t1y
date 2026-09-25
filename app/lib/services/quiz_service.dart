import 'package:uuid/uuid.dart';

import '../models/quiz.dart';
import 'api_client.dart';

class QuizAttemptResult {
  final int scorePercent;
  final int pointsAwarded;
  final int pointsPossible;
  final bool? passed;

  QuizAttemptResult({
    required this.scorePercent,
    required this.pointsAwarded,
    required this.pointsPossible,
    required this.passed,
  });
}

/// Quiz reading and submission. Submission goes through `/api/sync` — the
/// same offline-push endpoint the full outbox design uses — so grading is
/// always the server's, never a value the device asserts. This v1 pushes
/// immediately rather than queuing offline (see content_service.dart's note);
/// a QUIZ_ATTEMPT event still carries a client-generated id, so it would
/// slot into a real outbox later without changing the wire format.
class QuizService {
  QuizService._();
  static final QuizService instance = QuizService._();

  static const _uuid = Uuid();

  Future<List<Quiz>> getQuizzes(String locale) async {
    final data = await ApiClient.instance.get('/api/quizzes/bundle', query: {'locale': locale});
    return (data['data']['items'] as List).map((q) => Quiz.fromJson(q as Map<String, dynamic>)).toList();
  }

  /// Submits one quiz attempt and returns the server-graded result. Grading
  /// happens server-side even though the UI can compute a local preview —
  /// see lib/quizzes/grading.ts on the backend for why a client verdict is
  /// never trusted.
  Future<QuizAttemptResult> submitAttempt({
    required Quiz quiz,
    required DateTime startedAt,
    required List<Map<String, dynamic>> responses,
  }) async {
    final now = DateTime.now().toUtc();
    final eventId = _uuid.v4();

    final result = await ApiClient.instance.post('/api/sync', body: {
      'sentAt': now.toIso8601String(),
      'events': [
        {
          'clientId': eventId,
          'type': 'QUIZ_ATTEMPT',
          'occurredAt': now.toIso8601String(),
          'payload': {
            'quizSlug': quiz.slug,
            'locale': quiz.locale,
            'startedAt': startedAt.toUtc().toIso8601String(),
            'completedAt': now.toIso8601String(),
            'responses': responses,
          },
        }
      ],
    });

    final accepted = (result['data']['accepted'] as List);
    final rejected = (result['data']['rejected'] as List);
    if (accepted.isEmpty) {
      final reason = rejected.isNotEmpty ? rejected.first['message'] as String : 'Submission failed.';
      throw ApiException(0, 'SYNC_REJECTED', reason);
    }

    // The sync endpoint reports accept/duplicate/reject but not the score —
    // pull the graded attempt back via progress so the result screen shows
    // the server's real numbers, not a client guess.
    final progress = await ApiClient.instance.get('/api/progress');
    final attempts = progress['data']['attempts'] as List;
    final latest = attempts.firstWhere(
      (a) => a['quizId'] == quiz.id,
      orElse: () => null,
    );

    if (latest == null) {
      throw ApiException(0, 'SYNC_REJECTED', 'The attempt was recorded but its score could not be read back.');
    }

    return QuizAttemptResult(
      scorePercent: latest['scorePercent'] as int? ?? 0,
      pointsAwarded: 0,
      pointsPossible: 0,
      passed: latest['passed'] as bool?,
    );
  }
}

import '../models/support.dart';
import 'api_client.dart';

/// A parent's questions to the study team, and the answers.
class SupportService {
  static final SupportService instance = SupportService.internal();

  /// Constructible for tests; the app uses [instance].
  SupportService.internal();

  Future<
    ({
      List<SupportThread> threads,
      int unreadAnswers,
      int dailyLimit,
      int remainingToday,
    })
  >
  list() async {
    final data = await ApiClient.instance.get('/api/support');
    final body = data['data'] as Map<String, dynamic>;
    return (
      threads: [
        for (final t in body['threads'] as List<dynamic>)
          SupportThread.fromJson(t as Map<String, dynamic>),
      ],
      unreadAnswers: (body['unreadAnswers'] as num?)?.toInt() ?? 0,
      dailyLimit: (body['dailyLimit'] as num?)?.toInt() ?? 3,
      remainingToday: (body['remainingToday'] as num?)?.toInt() ?? 3,
    );
  }

  /// How many answers are waiting to be read. Never throws — it feeds a badge,
  /// and a badge that cannot load is simply not shown.
  Future<int> unreadAnswers() async {
    try {
      return (await list()).unreadAnswers;
    } catch (_) {
      return 0;
    }
  }

  /// Sends a new question. Just the message: the team's inbox title is worked
  /// out from it on the server, and there is no link or attachment.
  /// How many messages may still be sent today, or null if that cannot be
  /// found out right now. Never throws — the server enforces the limit either
  /// way, so an unknown allowance just means the screen does not show it.
  Future<int?> remainingToday() async {
    try {
      return (await list()).remainingToday;
    } catch (_) {
      return null;
    }
  }

  Future<SupportThread> open({required String body}) async {
    final data = await ApiClient.instance.post(
      '/api/support',
      body: {'body': body},
    );
    final created = data['data'] as Map<String, dynamic>;
    return thread(created['id'] as String);
  }

  /// One conversation. Opening it marks the team's answers as read.
  Future<SupportThread> thread(String id) async {
    final data = await ApiClient.instance.get('/api/support/$id');
    return SupportThread.fromJson(data['data'] as Map<String, dynamic>);
  }

  Future<void> reply(String id, {required String body}) async {
    await ApiClient.instance.post('/api/support/$id', body: {'body': body});
  }
}

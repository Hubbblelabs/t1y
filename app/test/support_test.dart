import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/models/support.dart';

void main() {
  group('where a question stands', () {
    SupportMessage message(String role, {DateTime? readAt, String id = 'm'}) =>
        SupportMessage(
          id: id,
          authorRole: role,
          authorName: '',
          body: 'text',
          createdAt: DateTime(2026, 9, 20),
          readAt: readAt,
        );

    SupportThread thread(String status, List<SupportMessage> messages) =>
        SupportThread(
          id: 't',
          subject: 'A question',
          status: status,
          lastMessageAt: DateTime(2026, 9, 20),
          messages: messages,
        );

    test('is Sent until the team opens it', () {
      expect(
        thread('AWAITING_REPLY', [message('PARENT')]).state,
        SupportState.sent,
      );
    });

    test('is Seen once the team has opened it but not answered', () {
      final seen = thread('AWAITING_REPLY', [
        message('PARENT', readAt: DateTime(2026, 9, 20, 9)),
      ]);
      expect(seen.state, SupportState.seen);
    });

    test('is Replied once the team has answered', () {
      final replied = thread('ANSWERED', [
        message('PARENT', readAt: DateTime(2026, 9, 20, 9), id: '1'),
        message('ADMIN', id: '2'),
      ]);
      expect(replied.state, SupportState.replied);
    });

    test('goes back to Sent when the parent writes again', () {
      // A follow-up puts it back in the team's queue, so it must not still
      // read "Replied".
      final followedUp = thread('AWAITING_REPLY', [
        message('PARENT', readAt: DateTime(2026, 9, 20, 9), id: '1'),
        message('ADMIN', id: '2'),
        message('PARENT', id: '3'),
      ]);
      expect(followedUp.state, SupportState.sent);
    });

    test('is Closed whatever else is true', () {
      expect(thread('CLOSED', [message('ADMIN')]).state, SupportState.closed);
    });

    test('counts only answers the parent has not opened', () {
      final t = thread('ANSWERED', [
        message('PARENT', id: '1'),
        message('ADMIN', id: '2'),
        message('ADMIN', readAt: DateTime(2026, 9, 20, 10), id: '3'),
      ]);
      expect(t.unreadAnswers, 1);
    });

    test('reads what the server sends', () {
      final t = SupportThread.fromJson({
        'id': 'abc',
        'subject': 'Low readings',
        'status': 'ANSWERED',
        'lastMessageAt': '2026-09-20T08:00:00.000Z',
        'messages': [
          {
            'id': 'm1',
            'authorRole': 'ADMIN',
            'body': 'Try this.',
            'readAt': null,
            'createdAt': '2026-09-20T08:00:00.000Z',
            'author': {'name': 'Coordinator'},
          },
        ],
      });

      expect(t.messages.single.fromTeam, isTrue);
      expect(t.messages.single.authorName, 'Coordinator');
      expect(t.state, SupportState.replied);
    });
  });
}

/// Where a question stands, in the words a parent would use.
///
/// Worked out from the conversation rather than stored, because it is a
/// property of it: whether the team has opened the last message, and whether
/// they have answered.
enum SupportState {
  /// Sent, and the team has not opened it yet.
  sent,

  /// The team has opened it but not answered.
  seen,

  /// The team has answered.
  replied,

  /// Dealt with and put away. Still readable.
  closed,
}

class SupportMessage {
  final String id;

  /// `PARENT` or `ADMIN`.
  final String authorRole;
  final String authorName;
  final String body;

  /// When the other side opened it.
  final DateTime? readAt;
  final DateTime createdAt;

  const SupportMessage({
    required this.id,
    required this.authorRole,
    required this.authorName,
    required this.body,
    required this.createdAt,
    this.readAt,
  });

  bool get fromTeam => authorRole == 'ADMIN';

  factory SupportMessage.fromJson(Map<String, dynamic> json) => SupportMessage(
    id: json['id'] as String,
    authorRole: json['authorRole'] as String,
    authorName:
        (json['author'] as Map<String, dynamic>?)?['name'] as String? ?? '',
    body: json['body'] as String? ?? '',
    readAt: json['readAt'] == null
        ? null
        : DateTime.tryParse(json['readAt'] as String)?.toLocal(),
    createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
  );
}

class SupportThread {
  final String id;
  final String subject;

  /// `AWAITING_REPLY`, `ANSWERED` or `CLOSED`.
  final String status;
  final DateTime lastMessageAt;
  final List<SupportMessage> messages;

  const SupportThread({
    required this.id,
    required this.subject,
    required this.status,
    required this.lastMessageAt,
    required this.messages,
  });

  SupportState get state {
    if (status == 'CLOSED') return SupportState.closed;
    if (messages.isEmpty) return SupportState.sent;

    final last = messages.last;
    if (last.fromTeam) return SupportState.replied;
    return last.readAt != null ? SupportState.seen : SupportState.sent;
  }

  /// Answers from the team this parent has not opened yet.
  int get unreadAnswers =>
      messages.where((m) => m.fromTeam && m.readAt == null).length;

  factory SupportThread.fromJson(Map<String, dynamic> json) => SupportThread(
    id: json['id'] as String,
    subject: json['subject'] as String,
    status: json['status'] as String,
    lastMessageAt: DateTime.parse(json['lastMessageAt'] as String).toLocal(),
    messages: [
      for (final m in (json['messages'] as List<dynamic>? ?? const []))
        SupportMessage.fromJson(m as Map<String, dynamic>),
    ],
  );
}

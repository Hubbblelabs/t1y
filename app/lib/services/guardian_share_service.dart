import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

/// One link the parent has made for a guardian.
class GuardianShare {
  final String id;

  /// `ACTIVE`, `USED`, `REVOKED`, `LOCKED` or `EXPIRED`.
  final String status;
  final DateTime createdAt;
  final DateTime expiresAt;
  final DateTime? usedAt;
  final String? guardianName;

  /// The 6-digit code — only sent by the server while the link is live.
  final String? code;

  const GuardianShare({
    required this.id,
    required this.status,
    required this.createdAt,
    required this.expiresAt,
    this.usedAt,
    this.guardianName,
    this.code,
  });

  bool get isActive => status == 'ACTIVE';
  bool get isUsed => status == 'USED';

  factory GuardianShare.fromJson(Map<String, dynamic> json) => GuardianShare(
    id: json['id'] as String,
    status: json['status'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
    expiresAt: DateTime.parse(json['expiresAt'] as String).toLocal(),
    usedAt: json['usedAt'] == null
        ? null
        : DateTime.parse(json['usedAt'] as String).toLocal(),
    guardianName: json['guardianName'] as String?,
    code: json['code'] as String?,
  );
}

/// What creating a link returns: the link itself, shown once.
class CreatedShare {
  final String id;
  final String url;
  final String code;
  final DateTime expiresAt;

  const CreatedShare({
    required this.id,
    required this.url,
    required this.code,
    required this.expiresAt,
  });
}

/// Links a parent gives a guardian (a teacher, say) so readings can be
/// recorded while the parent is away. The server never stores the link — only
/// a hash — so the app keeps the URL itself to be able to share it again.
class GuardianShareService {
  GuardianShareService._();
  static final GuardianShareService instance = GuardianShareService._();

  static const _urlKeyPrefix = 'guardian_link_';
  static const _seenKey = 'guardian_seen_used';

  Future<CreatedShare> create({
    required int expiresInMinutes,

    /// What the guardian is asked to record: `GLUCOSE`, `INSULIN`, `CARBS`
    /// and/or `EXERCISE`.
    required List<String> collect,

    /// A short note shown to the guardian on their page.
    String? purpose,
  }) async {
    final note = purpose?.trim() ?? '';
    final data = await ApiClient.instance.post(
      '/api/guardian-shares',
      body: {
        'expiresInMinutes': expiresInMinutes,
        'collect': collect,
        if (note.isNotEmpty) 'purpose': note,
      },
    );
    final row = data['data'] as Map<String, dynamic>;
    final created = CreatedShare(
      id: row['id'] as String,
      url: row['url'] as String,
      code: row['code'] as String,
      expiresAt: DateTime.parse(row['expiresAt'] as String).toLocal(),
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_urlKeyPrefix${created.id}', created.url);
    return created;
  }

  Future<List<GuardianShare>> list() async {
    final data = await ApiClient.instance.get('/api/guardian-shares');
    return [
      for (final row in data['data'] as List<dynamic>)
        GuardianShare.fromJson(row as Map<String, dynamic>),
    ];
  }

  Future<void> revoke(String id) async {
    await ApiClient.instance.delete('/api/guardian-shares/$id');
  }

  /// The link for a live share, if this phone made it.
  Future<String?> savedUrl(String id) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('$_urlKeyPrefix$id');
  }

  /// Links a guardian has used that the parent has not yet been told about.
  Future<List<GuardianShare>> unseenUsed(List<GuardianShare> shares) async {
    final prefs = await SharedPreferences.getInstance();
    final seen = prefs.getStringList(_seenKey) ?? const [];
    return [
      for (final s in shares)
        if (s.isUsed && !seen.contains(s.id)) s,
    ];
  }

  Future<void> markSeen(Iterable<GuardianShare> shares) async {
    final prefs = await SharedPreferences.getInstance();
    final seen = {...(prefs.getStringList(_seenKey) ?? const <String>[])};
    seen.addAll(shares.map((s) => s.id));
    await prefs.setStringList(_seenKey, seen.toList());
    for (final s in shares) {
      await prefs.remove('$_urlKeyPrefix${s.id}');
    }
  }
}

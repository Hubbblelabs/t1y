import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

/// The child/participant profile.
///
/// The sign-up chat collects the child's name, date of birth, sex and
/// diagnosis year, but sign-up itself cannot persist them: the backend runs
/// `autoSignIn: false`, so there is no session at the moment the chat
/// finishes and `PATCH /api/users/me` would be unauthenticated. Those answers
/// were previously just dropped on the floor.
///
/// So they are stashed locally at sign-up and flushed on the first
/// authenticated request after sign-in ([flushPendingProfile]).
class ProfileService {
  ProfileService._();
  static final ProfileService instance = ProfileService._();

  static const _pendingKey = 'pending_profile';
  static const _cacheKey = 'profile_cache';

  /// Chat answer -> Prisma `Sex` enum.
  static const _sexMap = {
    'Female': 'FEMALE',
    'Male': 'MALE',
    'Prefer not to say': 'PREFER_NOT_TO_SAY',
  };

  /// Stashes the sign-up chat answers until there is a session to send them
  /// with. [answers] uses the keys from `models/signup_question.dart`.
  Future<void> stashSignupAnswers(Map<String, String> answers) async {
    final profile = <String, dynamic>{
      if (answers['firstName'] != null) 'firstName': answers['firstName'],
      if (answers['lastName'] != null) 'lastName': answers['lastName'],
      if (answers['dateOfBirth'] != null) 'dateOfBirth': answers['dateOfBirth'],
      if (answers['sex'] != null) 'sex': _sexMap[answers['sex']] ?? 'UNSPECIFIED',
      if (answers['diagnosisYear'] != null)
        'diagnosisYear': int.tryParse(answers['diagnosisYear']!),
      // Every participant in this study is Type 1 by the inclusion criteria.
      'diabetesType': 'TYPE_1',
    };
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_pendingKey, jsonEncode(profile));
  }

  /// Sends any stashed sign-up answers. Safe to call on every sign-in — it
  /// no-ops when nothing is pending, and clears the stash on success so the
  /// details are never re-sent over hand-edited values.
  Future<void> flushPendingProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_pendingKey);
    if (raw == null) return;

    try {
      await ApiClient.instance.patch(
        '/api/users/me',
        body: {'profile': jsonDecode(raw)},
      );
      await prefs.remove(_pendingKey);
    } catch (_) {
      // Leave it queued; retried on the next sign-in.
    }
  }

  /// Current user + profile, server-truth with a local fallback so the
  /// Profile screen still renders offline.
  Future<Map<String, dynamic>?> me({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cached = await _readCache();
      if (cached != null) {
        _refresh();
        return cached;
      }
    }
    return _refresh();
  }

  Future<Map<String, dynamic>?> _refresh() async {
    try {
      final data = await ApiClient.instance.get('/api/users/me');
      final me = data['data'] as Map<String, dynamic>;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, jsonEncode(me));
      return me;
    } catch (_) {
      return _readCache();
    }
  }

  Future<Map<String, dynamic>?> _readCache() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey);
  }
}

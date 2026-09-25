import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../config/default_questions.dart';
import '../models/question.dart';
import 'api_client.dart';

/// Where the questions a parent is asked come from.
///
/// The dashboard decides what is asked; this fetches that list and keeps it
/// usable in every situation the app meets:
///
///  * **Online**: the server's list, cached for next time.
///  * **Offline, or the server is down**: the last list that was cached.
///  * **First launch with no connection**: the copy bundled with the app.
///
/// Nothing here ever throws. Sign-up is the one screen a family cannot be
/// stopped at by a slow request, so every path ends in a usable list.
class QuestionService {
  QuestionService._();
  static final QuestionService instance = QuestionService._();

  static const _signupKey = 'signup_questions_cache';
  static const _profileKey = 'profile_questions_cache';

  /// Short, because a person is waiting to be asked the first question.
  static const _fetchTimeout = Duration(seconds: 6);

  /// Sign-up cannot work without these four — the child's account is created
  /// from them. A list missing any of them is treated as a server fault and the
  /// bundled copy is used instead, so a misconfiguration in the dashboard can
  /// never leave the chat with nothing to ask.
  static const _coreKeys = ['name', 'dateOfBirth', 'sex', 'diagnosisYear'];

  /// The questions the sign-up chat asks, in order.
  ///
  /// Cache-first: if a list is already on the phone it is returned at once and
  /// refreshed in the background, so opening the chat is never delayed by the
  /// network. A change made in the dashboard therefore reaches a phone on its
  /// next sign-up rather than its current one, which is the right trade for a
  /// screen people pass through once.
  Future<List<Question>> signupQuestions() async {
    final cached = await _readCache(_signupKey);
    if (cached != null && _isUsableSignupList(cached)) {
      unawaited(_fetch('/api/signup-questions', _signupKey, public: true));
      return cached;
    }

    final fetched = await _fetch(
      '/api/signup-questions',
      _signupKey,
      public: true,
    );
    if (fetched != null && _isUsableSignupList(fetched)) return fetched;

    return defaultQuestions.where((q) => q.showOnSignup).toList();
  }

  /// Every question the profile screen asks — built-in and added together.
  Future<List<Question>> profileQuestions() async {
    final cached = await _readCache(_profileKey);
    if (cached != null && cached.isNotEmpty) {
      unawaited(_fetch('/api/profile-questions', _profileKey));
      return _sorted(cached);
    }

    final fetched = await _fetch('/api/profile-questions', _profileKey);
    if (fetched != null && fetched.isNotEmpty) return _sorted(fetched);

    return _sorted(defaultQuestions);
  }

  bool _isUsableSignupList(List<Question> list) {
    final keys = list.map((q) => q.key).toSet();
    return _coreKeys.every(keys.contains);
  }

  List<Question> _sorted(List<Question> list) =>
      [...list]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

  Future<List<Question>?> _fetch(
    String path,
    String cacheKey, {
    bool public = false,
  }) async {
    try {
      final data =
          await (public
                  ? ApiClient.instance.getPublic(path)
                  : ApiClient.instance.get(path))
              .timeout(_fetchTimeout);
      final raw = (data['data'] as List<dynamic>);
      final questions = raw
          .map((q) => Question.fromJson(q as Map<String, dynamic>))
          .toList();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        cacheKey,
        jsonEncode(questions.map((q) => q.toJson()).toList()),
      );
      return questions;
    } catch (_) {
      return null;
    }
  }

  Future<List<Question>?> _readCache(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(key);
      if (raw == null) return null;
      return (jsonDecode(raw) as List<dynamic>)
          .map((q) => Question.fromJson(q as Map<String, dynamic>))
          .toList();
    } catch (_) {
      // A cache that cannot be read is the same as no cache.
      return null;
    }
  }
}

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/question.dart';
import '../providers/app_state.dart';
import 'api_client.dart';

/// The child/participant profile.
///
/// The sign-up chat collects the child's details, but they are stashed on the
/// phone and sent on the first authenticated request rather than at the moment
/// the chat finishes: the account does not exist until the chat is over, and
/// `PATCH /api/users/me` needs a session. If that first send fails (no
/// signal), the stash is kept and retried on the next sign-in, so nothing a
/// parent typed is lost.
class ProfileService {
  ProfileService._();
  static final ProfileService instance = ProfileService._();

  static const _pendingKey = 'pending_profile';
  static const _pendingLocaleKey = 'pending_locale';
  static const _cacheKey = 'profile_cache';

  /// Stashes the sign-up chat answers until there is a session to send them
  /// with.
  ///
  /// [answers] is keyed by question key and holds what the chat stored: text as
  /// typed, a date as `yyyy-MM-dd`, a number as typed, and a pick-one as the
  /// option's *value* (`FEMALE`), never its wording. Each answer is routed by
  /// its question: a built-in question lives in a real profile column, an added
  /// one in the free-form bucket.
  Future<void> stashSignupAnswers(
    Map<String, String> answers,
    List<Question> questions,
  ) async {
    final profile = buildProfilePayload(answers, questions);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_pendingKey, jsonEncode(profile));
  }

  /// Turns raw form answers into the body of `PATCH /api/users/me`.
  ///
  /// Public so it can be tested without a phone: getting an answer into the
  /// wrong place — a height in the free-form bucket, a name as a number — is a
  /// silent data-loss bug, not a crash.
  ///
  /// [sendBlanksAsNull] is the difference between signing up and editing.
  /// Signing up simply leaves an unanswered question out. Editing must be able
  /// to *clear* one — a parent removing a phone number — which the server only
  /// understands as an explicit null. A pick-one that was never chosen is
  /// always left out, never cleared: there is nothing to unset.
  static Map<String, dynamic> buildProfilePayload(
    Map<String, String> answers,
    List<Question> questions, {
    bool sendBlanksAsNull = false,
  }) {
    final profile = <String, dynamic>{};
    final custom = <String, dynamic>{};

    for (final question in questions) {
      final raw = answers[question.key]?.trim();
      final blank = raw == null || raw.isEmpty;

      Object? value;
      if (blank) {
        if (!sendBlanksAsNull || question.required) continue;
        if (question.fieldType == 'CHOICE') continue;
        value = null;
      } else {
        value = _typed(question, raw);
        if (value == null) continue;
      }

      if (question.builtIn) {
        profile[question.key] = value;
      } else {
        custom[question.key] = value;
      }
    }

    // Every participant in this study is Type 1 by the inclusion criteria.
    profile['diabetesType'] = 'TYPE_1';
    if (custom.isNotEmpty) profile['customFieldValues'] = custom;
    return profile;
  }

  /// The answer in the type the server expects for this kind of question.
  static Object? _typed(Question question, String raw) {
    if (question.fieldType != 'NUMBER') return raw;
    final number = num.tryParse(raw);
    if (number == null) return null;
    // A year or a count is a whole number; the server rejects 2020.0 for one.
    return question.rules['wholeNumber'] == true ? number.toInt() : number;
  }

  /// Sends any stashed sign-up answers. Safe to call on every sign-in — it
  /// no-ops when nothing is pending, and clears the stash on success so the
  /// details are never re-sent over hand-edited values.
  Future<void> flushPendingProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_pendingKey);
    final locale = prefs.getString(_pendingLocaleKey);
    if (raw == null && locale == null) return;

    try {
      await ApiClient.instance.patch(
        '/api/users/me',
        body: {
          if (raw != null) 'profile': jsonDecode(raw),
          'locale': ?locale,
        },
      );
      await prefs.remove(_pendingKey);
      await prefs.remove(_pendingLocaleKey);
    } catch (_) {
      // Leave it queued; retried on the next sign-in.
    }
  }

  /// The language chosen in the sign-up chat, kept until there is an account
  /// to save it on (see [flushPendingProfile]). Applied to the app at once.
  Future<void> stashPreferredLocale(String locale) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_pendingLocaleKey, locale);
    await AppState.instance.setLocale(locale);
  }

  /// After signing in: switch the app to the language saved on this account,
  /// so each child opens in the language their family chose.
  Future<void> adoptServerLocale() async {
    final me = await this.me(forceRefresh: true);
    final locale = me?['locale'];
    if ((locale == 'en' || locale == 'ta') &&
        locale != AppState.instance.locale) {
      await AppState.instance.setLocale(locale as String);
    }
  }

  /// The parent switched language: remember it on the account too, so it is
  /// the default the next time they sign in. Best-effort — the switch itself
  /// has already happened on the phone.
  Future<void> saveLocale(String locale) async {
    try {
      await ApiClient.instance.patch('/api/users/me', body: {'locale': locale});
    } catch (_) {
      // No account yet (switched on the terms screen during sign-up), or no
      // signal: kept, and sent with the rest of the sign-up answers.
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_pendingLocaleKey, locale);
    }
  }

  /// Saves any subset of the extended profile fields (phone, address,
  /// treatment details, emergency contact, …) — the ones a parent fills in
  /// after sign-up, separately from the identity fields captured in the
  /// chat. Refreshes the cache on success so the Profile screen reflects it
  /// immediately without a second round trip.
  Future<void> updateProfile(Map<String, dynamic> fields) async {
    final data = await ApiClient.instance.patch(
      '/api/users/me',
      body: {'profile': fields},
    );
    final me = data['data'] as Map<String, dynamic>;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cacheKey, jsonEncode(me));
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

  /// Deletes this child's account (see DELETE /api/users/me for exactly what
  /// is removed). The account password is asked for again.
  Future<void> deleteAccount(String password) async {
    await ApiClient.instance.delete(
      '/api/users/me',
      body: {'password': password},
    );
  }

  Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey);
  }
}

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The patient-diary details a parent is asked to complete a few days after
/// they start using the app: sex, date of birth, telephone, address, height,
/// weight, treating doctor and diabetes educator. (The two hospital numbers
/// are asked too but optional — not every family has them — so they never
/// count as missing.)
///
/// Until they are all filled, Home shows a card asking for them and the phone
/// sends a reminder every day.
class DiaryDetails {
  DiaryDetails._();

  /// True while the details are due. The header's profile button shows a "!"
  /// from this, so the way to fix it is visible on every screen — even after
  /// the Home notice has been dismissed for the day.
  static final ValueNotifier<bool> attention = ValueNotifier<bool>(false);

  static const _dismissedKey = 'details_notice_dismissed_on';

  static String _today() {
    final n = DateTime.now();
    return '${n.year}-${n.month}-${n.day}';
  }

  /// Whether the notice on Home was closed with its X today. It comes back the
  /// next day, for as long as details are still missing.
  static Future<bool> noticeDismissedToday() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_dismissedKey) == _today();
  }

  static Future<void> dismissNoticeToday() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_dismissedKey, _today());
  }

  /// How many days after the account was created before the app starts asking.
  static const daysBeforeAsking = 3;

  /// Profile keys that must be filled. Most live on the profile itself; `address`
  /// and `educatorName` are admin-defined questions kept in `customFieldValues`.
  static const requiredKeys = [
    'sex',
    'dateOfBirth',
    'phone',
    'address',
    'heightCm',
    'baselineWeightKg',
    'primaryClinician',
    'educatorName',
  ];

  static bool _blank(Object? v) =>
      v == null ||
      (v is String && (v.trim().isEmpty || v == 'UNSPECIFIED'));

  /// The required details still blank, from a `/api/users/me` response.
  static List<String> missing(Map<String, dynamic>? me) {
    final profile = me?['profile'] as Map<String, dynamic>?;
    if (profile == null) return const [];
    final custom =
        (profile['customFieldValues'] as Map<String, dynamic>?) ?? const {};
    return [
      for (final key in requiredKeys)
        if (_blank(profile[key]) && _blank(custom[key])) key,
    ];
  }

  /// Days since the account was created (0 if unknown).
  static int accountAgeDays(Map<String, dynamic>? me, [DateTime? now]) {
    final created = DateTime.tryParse(me?['createdAt'] as String? ?? '');
    if (created == null) return 0;
    return (now ?? DateTime.now()).difference(created.toLocal()).inDays;
  }

  /// True when the family should now be asked: a few days in, details missing.
  static bool due(Map<String, dynamic>? me, [DateTime? now]) =>
      accountAgeDays(me, now) >= daysBeforeAsking && missing(me).isNotEmpty;
}

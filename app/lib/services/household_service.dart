import '../models/child.dart';
import 'api_client.dart';
import 'profile_service.dart';

/// Parent sign-in and the child picker.
///
/// Sign-in is two calls rather than one:
///
///   1. [lookup] proves the password and returns the children that
///      identifier covers, so the app can show the picker.
///   2. [selectChild] signs in as the chosen child and stores that session.
///
/// The password is held only in memory between the two, and both calls
/// authenticate independently — the second never trusts that the first
/// happened. See api/app/api/household/ for the matching routes.
class HouseholdService {
  HouseholdService._();
  static final HouseholdService instance = HouseholdService._();

  /// Step one. [identifier] is whatever the parent typed: their email, their
  /// phone number, or one child's ID — the backend works out which.
  Future<HouseholdLookup> lookup({
    required String identifier,
    required String password,
  }) async {
    final data = await ApiClient.instance.post(
      '/api/household/children',
      body: {'identifier': identifier, 'password': password},
    );
    return HouseholdLookup.fromJson(data['data'] as Map<String, dynamic>);
  }

  /// Step two: opens a session as [childId] and persists its bearer token,
  /// so every later request is scoped to that child.
  ///
  /// Returns whether the account is still on an admin-issued temporary
  /// password, in which case the caller must send the parent to the
  /// change-password screen before anything else.
  Future<bool> selectChild({
    required String identifier,
    required String password,
    required String childId,
  }) async {
    final data = await ApiClient.instance.post(
      '/api/household/select',
      body: {
        'identifier': identifier,
        'password': password,
        'childId': childId,
      },
    );

    final payload = data['data'] as Map<String, dynamic>;
    await ApiClient.instance.setToken(payload['token'] as String);
    // Each child opens in the language their family chose for them.
    await ProfileService.instance.adoptServerLocale().catchError((_) {});
    return payload['mustChangePassword'] as bool? ?? false;
  }

  /// The signed-in child's siblings, including themselves (`isCurrent`).
  Future<List<Child>> siblings() async {
    final data = await ApiClient.instance.get('/api/household/add-child');
    return (data['data'] as List<dynamic>)
        .map((c) => Child.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  /// Enrols another child under this household.
  ///
  /// The new account is created awaiting the study coordinator's approval —
  /// a parent may add a child, but admission to the study is the
  /// coordinator's decision. Returns the new child's ID so the app can show
  /// it straight away.
  Future<String> addChild({
    required String name,
    DateTime? dateOfBirth,
    String? sex,
    int? diagnosisYear,
  }) async {
    final data = await ApiClient.instance.post(
      '/api/household/add-child',
      body: {
        'name': name,
        if (dateOfBirth != null) 'dateOfBirth': dateOfBirth.toIso8601String(),
        'sex': ?sex,
        'diagnosisYear': ?diagnosisYear,
      },
    );
    return (data['data'] as Map<String, dynamic>)['childId'] as String;
  }
}

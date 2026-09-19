import '../models/profile_field.dart';
import 'api_client.dart';

/// The admin-defined fields currently shown on the profile-edit form, on
/// top of the app's fixed built-in fields. See
/// api/lib/services/profile-fields.ts for the admin side.
///
/// No offline cache: this is a short, cheap list fetched once per visit to
/// the edit screen, and showing a stale set of admin fields (one that was
/// since retired, or missing one just added) is worse than an extra network
/// call — the edit screen already needs connectivity to save anyway.
class ProfileFieldsService {
  ProfileFieldsService._();
  static final ProfileFieldsService instance = ProfileFieldsService._();

  /// Returns `[]` on any failure rather than throwing — the edit screen
  /// still has its full set of built-in fields to show; admin-defined
  /// fields are additive, never load-bearing for the screen to work.
  Future<List<ProfileField>> fetchActiveFields() async {
    try {
      final data = await ApiClient.instance.get('/api/profile-fields');
      final list = data['data'] as List<dynamic>? ?? const [];
      return list
          .map((f) => ProfileField.fromJson(f as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return const [];
    }
  }
}

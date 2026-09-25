import '../models/badge.dart';
import 'api_client.dart';

/// Badges — the app's engagement layer.
///
/// Nothing here is authoritative: badges are awarded server-side from the
/// quiz attempt the backend graded (see api/lib/services/badges.ts), so the
/// app only ever reads them. A failed call is never fatal — a child who
/// can't reach the network still finishes their quiz, they just see the
/// badge on the next sync.
class RewardsService {
  RewardsService._();
  static final RewardsService instance = RewardsService._();

  Future<BadgeCollection> collection() async {
    final data = await ApiClient.instance.get('/api/badges');
    return BadgeCollection.fromJson(data['data'] as Map<String, dynamic>);
  }
}

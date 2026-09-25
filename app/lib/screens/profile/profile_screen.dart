import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/profile_service.dart';
import '../../services/session_actions.dart';
import '../../theme/app_theme.dart';
import '../../widgets/language_toggle.dart';
import '../../widgets/participant_id_card.dart';
import 'profile_details_screen.dart';
import 'settings_screen.dart';

/// The child's ID card, with Sign out on the card itself and a gear that opens
/// Settings as its own page.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _me;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    final me = await ProfileService.instance.me();
    if (!mounted) return;
    setState(() {
      _me = me;
      _loading = false;
    });
  }

  /// How many of the fuller details are still blank — the sign-up chat only
  /// asks for a few, so this is non-zero for most accounts until a parent
  /// fills the rest in.
  int _missingDetailCount(Map<String, dynamic>? profile) {
    if (profile == null) return _completableFields.length;
    return _completableFields.where((key) {
      final value = profile[key];
      return value == null || (value is String && value.trim().isEmpty);
    }).length;
  }

  static const _completableFields = [
    'phone',
    'city',
    'country',
    'heightCm',
    'baselineWeightKg',
    'emergencyContactName',
    'emergencyContactPhone',
  ];

  Future<void> _openDetails({bool edit = false}) async {
    final me = _me;
    if (me == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProfileDetailsScreen(me: me, startEditing: edit),
      ),
    );
    await _load();
  }

  Future<void> _openSettings() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const SettingsScreen()));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final profile = _me?['profile'] as Map<String, dynamic>?;
    final fullName = profile?['name'] as String? ?? '';
    final dobRaw = profile?['dateOfBirth'] as String?;
    final missingCount = _missingDetailCount(profile);

    return Scaffold(
      backgroundColor: AppTheme.lightest,
      appBar: AppBar(
        title: Text(S.profile),
        backgroundColor: AppTheme.lightest,
        actions: [
          const LanguageToggle(),
          IconButton(
            tooltip: S.settings,
            icon: const Icon(Icons.settings_outlined),
            onPressed: _openSettings,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _me == null
          ? _LoadFailedNotice(onRetry: _load)
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                child: Column(
                  children: [
                    if (missingCount > 0 && profile != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _CompleteProfileNudge(
                          missingCount: missingCount,
                          onTap: () => _openDetails(edit: true),
                        ),
                      ),
                    Expanded(
                      child: ParticipantIdCard(
                        name: fullName.isNotEmpty
                            ? fullName
                            : (_me?['name'] as String? ?? S.participant),
                        participantCode: profile?['participantCode'] as String?,
                        dateOfBirth: dobRaw == null
                            ? null
                            : DateTime.tryParse(dobRaw),
                        diagnosisYear: profile?['diagnosisYear'] as int?,
                        sex: profile?['sex'] as String?,
                        email: _me?['email'] as String?,
                        onSettings: _openSettings,
                        onSignOut: SessionActions.signOut,
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

/// A slim banner above the ID card when the fuller details haven't been
/// filled in.
class _CompleteProfileNudge extends StatelessWidget {
  final int missingCount;
  final VoidCallback onTap;

  const _CompleteProfileNudge({
    required this.missingCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.primary.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            children: [
              const Icon(Icons.info_outline, size: 16, color: AppTheme.deep),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  S.completeProfileNudge(missingCount),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.deep,
                  ),
                ),
              ),
              const Icon(Icons.chevron_right, size: 18, color: AppTheme.deep),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shown when the profile could not be fetched and nothing was cached.
class _LoadFailedNotice extends StatelessWidget {
  final VoidCallback onRetry;
  const _LoadFailedNotice({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 44, color: AppTheme.inkSoft),
            const SizedBox(height: 16),
            Text(
              S.couldNotLoad,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppTheme.deep,
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton(onPressed: onRetry, child: Text(S.tryAgain)),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config/api_config.dart';
import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../services/auth_service.dart';
import '../../services/content_service.dart';
import '../../services/profile_service.dart';
import '../../services/progress_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/flip_card.dart';
import '../../widgets/language_toggle.dart';
import '../../widgets/participant_id_card.dart';
import '../auth/get_started_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const _notificationsKey = 'notifications_enabled';

  Map<String, dynamic>? _me;
  bool _loading = true;
  bool _showSettings = false;
  bool _notificationsEnabled = true;
  bool _refreshing = false;
  String _serverUrl = '';
  DateTime? _lastSynced;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final me = await ProfileService.instance.me();
    final prefs = await SharedPreferences.getInstance();
    final url = await ApiConfig.getBaseUrl();
    final synced = await ContentService.instance.lastSyncedAt(AppState.instance.locale);
    if (!mounted) return;
    setState(() {
      _me = me;
      _notificationsEnabled = prefs.getBool(_notificationsKey) ?? true;
      _serverUrl = url;
      _lastSynced = synced;
      _loading = false;
    });
  }

  /// Manual "check for new content" — the same refresh the 24-hour background
  /// sync performs, exposed so a parent told that new material is available
  /// doesn't have to wait for the next tick.
  Future<void> _forceRefresh() async {
    setState(() => _refreshing = true);
    try {
      await ProgressService.instance.flush();
      await ContentService.instance.getTopics('en', forceRefresh: true);
      await ContentService.instance.getTopics('ta', forceRefresh: true);
      await ProfileService.instance.me(forceRefresh: true);
      final synced = await ContentService.instance.lastSyncedAt(AppState.instance.locale);
      if (!mounted) return;
      setState(() => _lastSynced = synced);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(S.contentUpdated), behavior: SnackBarBehavior.floating),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(S.couldNotReachServer),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _setNotifications(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_notificationsKey, value);
    setState(() => _notificationsEnabled = value);
  }

  Future<void> _signOut() async {
    await AuthService.instance.signOut();
    await ProfileService.instance.clearCache();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const GetStartedScreen()),
      (route) => false,
    );
  }

  String get _lastSyncedLabel {
    final t = _lastSynced;
    if (t == null) return S.never;
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inHours < 1) return '${diff.inMinutes} min ago';
    if (diff.inDays < 1) return '${diff.inHours} h ago';
    return '${diff.inDays} d ago';
  }

  @override
  Widget build(BuildContext context) {
    final profile = _me?['profile'] as Map<String, dynamic>?;
    final firstName = profile?['firstName'] as String? ?? '';
    final lastName = profile?['lastName'] as String? ?? '';
    final fullName = [firstName, lastName].where((s) => s.isNotEmpty).join(' ');
    final dobRaw = profile?['dateOfBirth'] as String?;

    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        backgroundColor: AppTheme.lightest,
        appBar: AppBar(
          // The title carries the face the card is showing, so the settings
          // side needs no heading of its own.
          title: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child: Text(
              _showSettings ? S.settings : S.profile,
              key: ValueKey(_showSettings),
            ),
          ),
          backgroundColor: AppTheme.lightest,
          leading: _showSettings
              ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => setState(() => _showSettings = false),
                )
              : null,
          // Language switch stays pinned at the top on both faces.
          actions: const [LanguageToggle(), SizedBox(width: 12)],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                  child: FlipCard(
                    showBack: _showSettings,
                    front: ParticipantIdCard(
                      name: fullName.isNotEmpty
                          ? fullName
                          : (_me?['name'] as String? ?? S.participant),
                      participantCode: profile?['participantCode'] as String?,
                      dateOfBirth: dobRaw == null ? null : DateTime.tryParse(dobRaw),
                      diagnosisYear: profile?['diagnosisYear'] as int?,
                      sex: profile?['sex'] as String?,
                      email: _me?['email'] as String?,
                      onFlip: () => setState(() => _showSettings = true),
                    ),
                    back: ParticipantSettingsCard(
                      onFlipBack: () => setState(() => _showSettings = false),
                      children: [
                        // Content refresh, given real weight rather than a
                        // line of grey text — this is the control a parent is
                        // told to use when new material is published.
                        _RefreshTile(
                          busy: _refreshing,
                          lastSynced: _lastSyncedLabel,
                          onTap: _refreshing ? null : _forceRefresh,
                        ),
                        const SizedBox(height: 14),
                        _Group(
                          title: S.notifications,
                          children: [
                            SwitchListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                              secondary: const Icon(Icons.notifications_outlined),
                              title: Text(
                                S.reminders,
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                S.remindersSubtitle,
                                style: const TextStyle(fontSize: 12),
                              ),
                              value: _notificationsEnabled,
                              onChanged: _setNotifications,
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        _Group(
                          title: S.privacyAndData,
                          children: [
                            ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                              leading: const Icon(Icons.privacy_tip_outlined),
                              title: Text(
                                AppState.instance.isTamil
                                    ? 'உங்கள் தரவு எவ்வாறு பயன்படுத்தப்படுகிறது'
                                    : 'How your data is used',
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                AppState.instance.isTamil
                                    ? 'நீங்கள் உள்ளிட்ட விவரங்களும் உங்கள் கற்றல் முன்னேற்றமும் இந்த ஆய்வுக்காக மட்டுமே சேகரிக்கப்படுகின்றன. அவை பொதுவில் பகிரப்படுவதில்லை.'
                                    : 'Details you enter and your learning progress are '
                                          'collected for the T1D Prajana Yandra study, kept '
                                          'private to the study team, and never shared publicly.',
                                style: const TextStyle(fontSize: 12, height: 1.4),
                              ),
                              isThreeLine: true,
                            ),
                            ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                              leading: const Icon(Icons.manage_accounts_outlined),
                              title: Text(
                                AppState.instance.isTamil
                                    ? 'தரவைத் திருத்த அல்லது நீக்க'
                                    : 'Correct or delete your data',
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                AppState.instance.isTamil
                                    ? 'உங்கள் ஆய்வு ஒருங்கிணைப்பாளரிடம் எந்த நேரத்திலும் கேட்கலாம்.'
                                    : 'Ask your study coordinator at any time.',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        if (!kReleaseMode) ...[
                          const SizedBox(height: 14),
                          _Group(
                            title: 'Developer',
                            children: [
                              ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                                leading: const Icon(Icons.dns_outlined),
                                title: const Text(
                                  'Server',
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                subtitle: Text(
                                  _serverUrl,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 20),
                        // Sign out lives inside the card, per the design.
                        OutlinedButton.icon(
                          onPressed: _signOut,
                          icon: const Icon(Icons.logout, color: Colors.red, size: 19),
                          label: Text(
                            S.signOut,
                            style: const TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.red),
                            minimumSize: const Size.fromHeight(48),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

/// Prominent, self-explanatory refresh control with its own last-synced
/// timestamp — replaces the plain list row that read as inert text.
class _RefreshTile extends StatelessWidget {
  final bool busy;
  final String lastSynced;
  final VoidCallback? onTap;

  const _RefreshTile({required this.busy, required this.lastSynced, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppTheme.primary, AppTheme.deep],
          ),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 34,
              height: 34,
              child: busy
                  ? const CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white)
                  : Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.sync, color: Colors.white, size: 19),
                    ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    S.checkForNewContent,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${S.lastUpdated}: $lastSynced',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
            if (!busy)
              Icon(
                Icons.chevron_right,
                color: Colors.white.withValues(alpha: 0.9),
              ),
          ],
        ),
      ),
    );
  }
}

class _Group extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _Group({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
          child: Text(
            title,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: AppTheme.deep.withValues(alpha: 0.65),
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.lightest.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(16),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(children: children),
        ),
      ],
    );
  }
}

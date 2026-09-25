import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../services/app_tour.dart';
import '../../services/content_service.dart';
import '../../services/local_reminders.dart';
import '../../services/mpin_service.dart';
import '../../services/profile_service.dart';
import '../../services/progress_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/language_toggle.dart';
import '../help/help_screen.dart';
import 'children_screen.dart';
import 'mpin_screen.dart';
import 'privacy_screen.dart';
import 'profile_details_screen.dart';

/// Settings, as a plain page — sections and rows, not a card.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _remindersOn = false;
  bool _refreshing = false;
  DateTime? _lastSynced;

  /// Null until loaded — the row behaves differently depending on whether a
  /// PIN exists, and guessing would send the parent into the wrong flow.
  bool? _mpinSet;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final on = await LocalReminders.isEnabled();
    final synced = await ContentService.instance.lastSyncedAt(
      AppState.instance.locale,
    );
    if (!mounted) return;
    setState(() {
      _remindersOn = on;
      _lastSynced = synced;
    });
    try {
      final status = await MpinService.instance.status();
      if (mounted) setState(() => _mpinSet = status.isSet);
    } catch (_) {
      if (mounted) setState(() => _mpinSet = false);
    }
  }

  Future<void> _forceRefresh() async {
    setState(() => _refreshing = true);
    try {
      await ProgressService.instance.flush();
      await ContentService.instance.getTopics('en', forceRefresh: true);
      await ContentService.instance.getTopics('ta', forceRefresh: true);
      await ProfileService.instance.me(forceRefresh: true);
      final synced = await ContentService.instance.lastSyncedAt(
        AppState.instance.locale,
      );
      if (!mounted) return;
      setState(() => _lastSynced = synced);
      _toast(S.contentUpdated);
    } catch (_) {
      if (mounted) _toast(S.couldNotReachServer);
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  /// Turning reminders on asks first in the app's own words, then the phone
  /// shows its own "allow notifications" prompt. If the phone has them
  /// switched off already, the parent is taken to the phone's settings.
  Future<void> _toggleReminders(bool value) async {
    if (!value) {
      await LocalReminders.setEnabled(false);
      if (mounted) setState(() => _remindersOn = false);
      return;
    }

    final go = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(
          Icons.notifications_active_outlined,
          color: AppTheme.primary,
          size: 32,
        ),
        title: Text(S.allowRemindersTitle),
        content: Text(S.allowRemindersBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(S.notNow),
          ),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(S.allow),
          ),
        ],
      ),
    );
    if (go != true || !mounted) return;

    final granted = await LocalReminders.requestPermission();
    if (!mounted) return;
    if (!granted) {
      final open = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          content: Text(S.notificationsBlocked),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(S.notNow),
            ),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(S.openSettings),
            ),
          ],
        ),
      );
      if (open == true) await openAppSettings();
      return;
    }

    await LocalReminders.setEnabled(true);
    await LocalReminders.scheduleAfter(null);
    if (!mounted) return;
    setState(() => _remindersOn = true);
    _toast(S.remindersOn);
  }

  Future<void> _openMpin() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => MpinScreen(isReset: _mpinSet == true)),
    );
    if (changed != true || !mounted) return;
    setState(() => _mpinSet = true);
    _toast(S.pinSet);
  }

  Future<void> _openDetails() async {
    final me = await ProfileService.instance.me();
    if (me == null || !mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ProfileDetailsScreen(me: me)),
    );
  }

  void _startTour() {
    Navigator.of(context).popUntil((route) => route.isFirst);
    AppTour.request();
  }

  String get _lastSyncedLabel {
    final t = _lastSynced;
    if (t == null) return S.never;
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return S.justNow;
    if (diff.inHours < 1) return S.minutesAgo(diff.inMinutes);
    if (diff.inDays < 1) return S.hoursAgo(diff.inHours);
    return S.daysAgo(diff.inDays);
  }

  void _push(Widget page) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(S.settings),
        backgroundColor: Colors.white,
        actions: const [LanguageToggle(), SizedBox(width: 12)],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: _RefreshTile(
              busy: _refreshing,
              lastSynced: _lastSyncedLabel,
              onTap: _refreshing ? null : _forceRefresh,
            ),
          ),
          _Header(S.yourDetails),
          _Row(
            icon: Icons.badge_outlined,
            title: S.details,
            subtitle: S.detailsSubtitle,
            onTap: _openDetails,
          ),
          _Header(S.notifications),
          SwitchListTile(
            secondary: const Icon(
              Icons.notifications_outlined,
              color: AppTheme.deep,
            ),
            title: Text(S.reminders, style: _Row.titleStyle),
            subtitle: Text(S.remindersSubtitle, style: _Row.subtitleStyle),
            value: _remindersOn,
            onChanged: _toggleReminders,
          ),
          _Header(S.familyAndSecurity),
          _Row(
            icon: Icons.family_restroom_outlined,
            title: S.yourChildren,
            subtitle: S.childIdHint,
            onTap: () => _push(const ChildrenScreen()),
          ),
          _Row(
            icon: Icons.pin_outlined,
            title: S.parentPin,
            subtitle: _mpinSet == null
                ? S.loading
                : (_mpinSet! ? S.forgotPin : S.pinNotSetTitle),
            onTap: _mpinSet == null ? null : _openMpin,
          ),
          _Header(S.helpAndSupport),
          _Row(
            icon: Icons.support_agent_outlined,
            title: S.askAQuestion,
            subtitle: S.helpIntro,
            onTap: () => _push(const HelpScreen()),
          ),
          _Row(
            icon: Icons.tour_outlined,
            title: S.takeTheTour,
            subtitle: S.takeTheTourSubtitle,
            onTap: _startTour,
          ),
          _Header(S.privacyAndData),
          _Row(
            icon: Icons.privacy_tip_outlined,
            title: S.howDataUsed,
            subtitle: S.howDataUsedSubtitle,
            onTap: () => _push(const PrivacyScreen()),
          ),
          _Row(
            icon: Icons.manage_accounts_outlined,
            title: S.correctOrDelete,
            subtitle: S.correctOrDeleteSubtitle,
            onTap: () => _push(const DataRightsScreen()),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () => _push(const ChildrenScreen(switching: true)),
              icon: const Icon(Icons.switch_account_outlined),
              label: Text(S.switchProfile),
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final String text;
  const _Header(this.text);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 22, 20, 4),
    child: Text(
      text.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.8,
        color: AppTheme.primary,
      ),
    ),
  );
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  const _Row({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  static const titleStyle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: AppTheme.ink,
  );
  static const subtitleStyle = TextStyle(
    fontSize: 12.5,
    height: 1.35,
    color: AppTheme.inkSoft,
  );

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ListTile(
          leading: Icon(icon, color: AppTheme.deep),
          title: Text(title, style: titleStyle),
          subtitle: Text(subtitle, style: subtitleStyle),
          trailing: const Icon(Icons.chevron_right, color: AppTheme.inkSoft),
          onTap: onTap,
        ),
        const Divider(height: 1, indent: 72, color: Color(0xFFE5EAF1)),
      ],
    );
  }
}

/// The "check for new content" control — the same refresh the daily
/// background sync performs, for when a parent is told new material is out.
class _RefreshTile extends StatelessWidget {
  final bool busy;
  final String lastSynced;
  final VoidCallback? onTap;

  const _RefreshTile({
    required this.busy,
    required this.lastSynced,
    this.onTap,
  });

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
                  ? const CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: Colors.white,
                    )
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
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            if (!busy) const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

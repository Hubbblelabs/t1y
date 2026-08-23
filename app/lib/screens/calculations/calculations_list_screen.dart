import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../services/profile_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import 'ic_isf_screen.dart';
import 'rule_of_15_screen.dart';

class CalculationsListScreen extends StatefulWidget {
  const CalculationsListScreen({super.key});

  @override
  State<CalculationsListScreen> createState() => _CalculationsListScreenState();
}

class _CalculationsListScreenState extends State<CalculationsListScreen> {
  // A field initializer, not `late` + initState: this screen is kept alive
  // inside HomeShell's IndexedStack, and a `late` field assigned in
  // initState has thrown LateInitializationError there before — assigning
  // here runs during construction, before build can ever see it unset.
  //
  // `forceRefresh: true` — this drives the IC/ISF lock gate, which an admin
  // can flip while the app is already open. `ProfileService.me()`'s normal
  // cache-first behaviour would show yesterday's lock state until some
  // unrelated call happened to warm the cache; a feature gate should never
  // be that stale in either direction.
  final Future<Map<String, dynamic>?> _me = ProfileService.instance.me(forceRefresh: true);

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        appBar: AppHeader(title: S.calculations),
        body: FutureBuilder<Map<String, dynamic>?>(
          future: _me,
          builder: (context, snapshot) {
            final profile = snapshot.data?['profile'] as Map<String, dynamic>?;
            // Prescribed per child, not a platform-wide switch — see
            // Profile.icIsfUnlocked and the admin's per-participant control.
            final icIsfEnabled = profile?['icIsfUnlocked'] == true;

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _CalculatorCard(
                  icon: Icons.local_cafe_outlined,
                  title: S.ruleOf15,
                  subtitle: S.ruleOf15Subtitle,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const RuleOf15Screen()),
                  ),
                ),
                const SizedBox(height: 12),
                _CalculatorCard(
                  icon: Icons.calculate_outlined,
                  title: S.icIsf,
                  subtitle: icIsfEnabled ? S.icIsfSubtitle : S.lockedNeedsCareTeam,
                  enabled: icIsfEnabled,
                  onTap: icIsfEnabled
                      ? () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const IcIsfScreen()),
                          )
                      : null,
                ),
                if (!icIsfEnabled) ...[
                  const SizedBox(height: 12),
                  const _LockExplainer(),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _CalculatorCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool enabled;

  const _CalculatorCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        enabled: enabled,
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: enabled ? const Icon(Icons.chevron_right) : const Icon(Icons.lock_outline),
        onTap: onTap,
      ),
    );
  }
}

/// Explains a locked calculator rather than leaving a dead, greyed-out row.
///
/// IC/ISF is gated behind a `clinicalSafety` feature flag because the ratios
/// it needs are prescribed per child — a generic default would produce a
/// plausible-looking but wrong insulin dose. So the honest answer to "why is
/// this locked?" is that the app does not have this child's numbers yet, and
/// the way to unlock it runs through the care team, not through the app.
class _LockExplainer extends StatelessWidget {
  const _LockExplainer();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.lightest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accent),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.lock_outline, size: 18, color: AppTheme.deep),
              const SizedBox(width: 8),
              Text(
                S.whyLocked,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: AppTheme.deep,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            S.lockExplainerBody,
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: Colors.black.withValues(alpha: 0.72),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            S.howToUnlock,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppTheme.deep,
            ),
          ),
          const SizedBox(height: 8),
          _Step(number: '1', text: S.lockExplainerStep1),
          _Step(number: '2', text: S.lockExplainerStep2),
          _Step(number: '3', text: S.lockExplainerStep3),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.info_outline,
                size: 15,
                color: AppTheme.deep.withValues(alpha: 0.6),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  S.ruleOf15AlwaysAvailable,
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: Colors.black.withValues(alpha: 0.55),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final String number;
  final String text;

  const _Step({required this.number, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppTheme.primary,
              shape: BoxShape.circle,
            ),
            child: Text(
              number,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: Colors.black.withValues(alpha: 0.72),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

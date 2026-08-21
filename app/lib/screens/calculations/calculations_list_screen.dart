import 'package:flutter/material.dart';

import '../../services/flags_service.dart';
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
  late Future<Map<String, bool>> _flags;

  @override
  void initState() {
    super.initState();
    _flags = FlagsService.instance.getFlags();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppHeader(title: 'Calculations'),
      body: FutureBuilder<Map<String, bool>>(
        future: _flags,
        builder: (context, snapshot) {
          final flags = snapshot.data ?? {};
          final icIsfEnabled = flags['ic_isf_calculator'] == true;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _CalculatorCard(
                icon: Icons.local_cafe_outlined,
                title: 'Rule of 15',
                subtitle: 'Hypoglycaemia — how much fast-acting sugar to take',
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const RuleOf15Screen()),
                ),
              ),
              const SizedBox(height: 12),
              _CalculatorCard(
                icon: Icons.calculate_outlined,
                title: 'IC / ISF Calculator',
                subtitle: icIsfEnabled
                    ? 'Insulin-to-carb ratio and correction factor'
                    : 'Locked — needs your care team',
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
                'Why is this locked?',
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
            'The IC (insulin-to-carbohydrate) ratio and ISF (correction factor) are '
            'different for every child, and change over time. The app has not been '
            'given your child\'s values, and guessing them could produce a dose that '
            'is unsafe.',
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: Colors.black.withValues(alpha: 0.72),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'How to unlock it',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: AppTheme.deep,
            ),
          ),
          const SizedBox(height: 8),
          const _Step(
            number: '1',
            text: 'Ask your diabetes care team for your child\'s current IC ratio and ISF.',
          ),
          const _Step(
            number: '2',
            text: 'Share them with your study coordinator, who records them against '
                'your child\'s profile.',
          ),
          const _Step(
            number: '3',
            text: 'The coordinator enables this calculator for your account. It will '
                'appear here the next time the app refreshes.',
          ),
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
                  'Rule of 15 stays available to everyone — it uses fixed amounts from '
                  'the Help Book, not a personal prescription.',
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

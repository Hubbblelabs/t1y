import 'package:flutter/material.dart';

import '../../services/flags_service.dart';
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
                    : 'Not enabled for this study yet',
                enabled: icIsfEnabled,
                onTap: icIsfEnabled
                    ? () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const IcIsfScreen()),
                        )
                    : null,
              ),
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

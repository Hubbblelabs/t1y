import 'package:flutter/material.dart';

import '../../widgets/pin_gate.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../services/calculator_runner.dart';
import '../../services/calculator_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/locale_aware.dart';
import 'calculator_screen.dart';

/// The calculators the study team has switched on.
///
/// Nothing here is written into the app: the list, and each calculator's
/// numbers and formulas, come from the dashboard. Hiding one there removes it
/// from this list; adding one puts it here, with no app release in between.
class CalculatorsScreen extends StatelessWidget {
  const CalculatorsScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      const PinGate(child: _CalculatorsBody());
}

class _CalculatorsBody extends StatefulWidget {
  const _CalculatorsBody();

  @override
  State<_CalculatorsBody> createState() => __CalculatorsBodyState();
}

class __CalculatorsBodyState extends State<_CalculatorsBody>
    with LocaleAware<_CalculatorsBody> {
  late Future<List<Calculator>> _future = CalculatorService.instance.list();

  @override
  void onLocaleChanged(String locale) => setState(() {});

  Future<void> _refresh() async {
    final next = CalculatorService.instance.list();
    setState(() => _future = next);
    await next;
  }

  @override
  Widget build(BuildContext context) {
    final locale = AppState.instance.locale;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(title: Text(S.calculators)),
      body: FutureBuilder<List<Calculator>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final calculators = snapshot.data ?? const <Calculator>[];

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text(
                  S.calculatorsIntro,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: Colors.black.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 16),
                if (calculators.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 60),
                    child: Text(
                      S.noCalculators,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.black.withValues(alpha: 0.5),
                      ),
                    ),
                  )
                else
                  for (final calculator in calculators) ...[
                    _CalculatorTile(
                      calculator: calculator,
                      locale: locale,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              CalculatorScreen(calculator: calculator),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CalculatorTile extends StatelessWidget {
  final Calculator calculator;
  final String locale;
  final VoidCallback onTap;

  const _CalculatorTile({
    required this.calculator,
    required this.locale,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final description = calculator.description(locale);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Ink(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppTheme.deep.withValues(alpha: 0.08)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.calculate_outlined,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    calculator.name(locale),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.deep,
                    ),
                  ),
                  if (description != null && description.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      description,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12.5,
                        height: 1.35,
                        color: Colors.black.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppTheme.primary),
          ],
        ),
      ),
    );
  }
}

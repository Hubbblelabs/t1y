import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../widgets/calculator_disclaimer.dart';

/// From the source curriculum's Nutrition article ("Carbohydrate counting"):
/// IC ratio = 500 / TDD, ISF (correction) = 1500 or 1800 / TDD. Displayed as
/// reference ratios only — this screen never suggests a dose, only the two
/// ratios a clinician has already explained to the family.
class IcIsfScreen extends StatefulWidget {
  const IcIsfScreen({super.key});

  @override
  State<IcIsfScreen> createState() => _IcIsfScreenState();
}

class _IcIsfScreenState extends State<IcIsfScreen> {
  bool _acknowledged = false;
  final _tddController = TextEditingController();
  bool _rapidActing = true;
  String? _result;

  void _calculate() {
    final tdd = double.tryParse(_tddController.text);
    if (tdd == null || tdd <= 0) {
      setState(() => _result = S.enterTotalDailyDose);
      return;
    }

    final icRatio = 500 / tdd;
    final isf = (_rapidActing ? 1800 : 1500) / tdd;

    setState(() {
      _result = S.icIsfResult(icRatio.toStringAsFixed(0), isf.toStringAsFixed(0));
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        appBar: AppBar(title: Text(S.icIsf)),
        body: !_acknowledged
            ? CalculatorDisclaimer(
                calculatorName: S.icIsfCalculator,
                onAcknowledge: () => setState(() => _acknowledged = true),
              )
            : Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _tddController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: S.totalDailyInsulinDose,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      title: Text(S.rapidActingInsulin),
                      subtitle: Text(_rapidActing ? S.uses1800Rule : S.uses1500Rule),
                      value: _rapidActing,
                      onChanged: (v) => setState(() => _rapidActing = v),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: _calculate, child: Text(S.calculate)),
                    if (_result != null) ...[
                      const SizedBox(height: 24),
                      Card(
                        color: Theme.of(context).colorScheme.primaryContainer,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(_result!),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
      ),
    );
  }
}

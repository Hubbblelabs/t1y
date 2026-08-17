import 'package:flutter/material.dart';

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
      setState(() => _result = 'Enter the total daily insulin dose (units).');
      return;
    }

    final icRatio = 500 / tdd;
    final isf = (_rapidActing ? 1800 : 1500) / tdd;

    setState(() {
      _result = 'IC ratio ≈ 1 unit per ${icRatio.toStringAsFixed(0)} g of carbs\n\n'
          'ISF (correction factor) ≈ 1 unit lowers blood glucose by ${isf.toStringAsFixed(0)} mg/dL\n\n'
          'These are starting-point ratios from the standard formula — your diabetes team should '
          'confirm and adjust them for you.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('IC / ISF Calculator')),
      body: !_acknowledged
          ? CalculatorDisclaimer(
              calculatorName: 'The IC / ISF calculator',
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
                    decoration: const InputDecoration(
                      labelText: 'Total daily insulin dose (units)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    title: const Text('Rapid-acting insulin'),
                    subtitle: Text(_rapidActing ? 'Uses 1800 rule' : 'Uses 1500 rule (short-acting)'),
                    value: _rapidActing,
                    onChanged: (v) => setState(() => _rapidActing = v),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: _calculate, child: const Text('Calculate')),
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
    );
  }
}

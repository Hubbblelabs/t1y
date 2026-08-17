import 'package:flutter/material.dart';

import '../../widgets/calculator_disclaimer.dart';

/// From the source curriculum's hypoglycaemia article: "eat 15-gram carbs,
/// check blood sugar level in 15 minutes... roughly 4-5mg glucose in the
/// blood increases with one gram of carbs." Uses 5 mg/dL per gram, matching
/// the article's own worked example (12g sugar to raise 60mg/dL).
class RuleOf15Screen extends StatefulWidget {
  const RuleOf15Screen({super.key});

  @override
  State<RuleOf15Screen> createState() => _RuleOf15ScreenState();
}

class _RuleOf15ScreenState extends State<RuleOf15Screen> {
  bool _acknowledged = false;
  final _bgController = TextEditingController();
  String? _result;

  static const _mgPerGram = 5;
  static const _targetBg = 100;

  void _calculate() {
    final bg = int.tryParse(_bgController.text);
    if (bg == null) {
      setState(() => _result = 'Enter a valid blood glucose value.');
      return;
    }

    if (bg >= 70) {
      setState(() => _result = 'Blood glucose is $bg mg/dL — the Rule of 15 is for readings below 70 mg/dL.');
      return;
    }

    final gramsNeeded = ((_targetBg - bg) / _mgPerGram).ceil();
    setState(() {
      _result = 'Take about $gramsNeeded g of fast-acting sugar (e.g. glucose tablets, '
          'juice, or ${(gramsNeeded / 15).ceil()} serving(s) of 15g carbs).\n\n'
          'Recheck blood glucose in 15 minutes. If still under 100 mg/dL, repeat with another 15g.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rule of 15')),
      body: !_acknowledged
          ? CalculatorDisclaimer(
              calculatorName: 'The Rule of 15 calculator',
              onAcknowledge: () => setState(() => _acknowledged = true),
            )
          : Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _bgController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Current blood glucose (mg/dL)',
                      border: OutlineInputBorder(),
                    ),
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

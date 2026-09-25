import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
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
      setState(() => _result = S.enterValidGlucose);
      return;
    }

    if (bg >= 70) {
      setState(() => _result = S.ruleOf15AboveRange(bg));
      return;
    }

    final gramsNeeded = ((_targetBg - bg) / _mgPerGram).ceil();
    setState(() {
      _result = S.ruleOf15Result(gramsNeeded, (gramsNeeded / 15).ceil());
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        appBar: AppBar(title: Text(S.ruleOf15)),
        body: !_acknowledged
            ? CalculatorDisclaimer(
                calculatorName: S.ruleOf15Calculator,
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
                      decoration: InputDecoration(
                        labelText: S.currentBloodGlucose,
                        border: const OutlineInputBorder(),
                      ),
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

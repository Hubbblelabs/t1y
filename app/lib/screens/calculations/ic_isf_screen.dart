import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../widgets/calculator_disclaimer.dart';

/// From the source curriculum's Nutrition and Insulin Basics articles: TDD
/// gives IC ratio (500/TDD) and ISF (1500 or 1800/TDD); those ratios then
/// convert a meal's carbs into a bolus dose, and a blood-glucose reading
/// away from target into a correction dose — the curriculum's full 5-step
/// worked example (Rama's carb counting; the 1980 Davidson formula), not
/// just the two reference ratios. Every result carries the same instruction
/// the source material gives alongside its own worked numbers: confirm with
/// the diabetes team before dosing.
class IcIsfScreen extends StatefulWidget {
  const IcIsfScreen({super.key});

  @override
  State<IcIsfScreen> createState() => _IcIsfScreenState();
}

class _IcIsfScreenState extends State<IcIsfScreen> {
  bool _acknowledged = false;

  final _tddController = TextEditingController();
  bool _rapidActing = true;
  double? _icRatio;
  double? _isf;

  final _carbsController = TextEditingController();
  String? _mealDoseResult;

  final _currentBgController = TextEditingController();
  final _targetBgController = TextEditingController();
  String? _correctionResult;

  @override
  void dispose() {
    _tddController.dispose();
    _carbsController.dispose();
    _currentBgController.dispose();
    _targetBgController.dispose();
    super.dispose();
  }

  void _calculateRatios() {
    final tdd = double.tryParse(_tddController.text);
    if (tdd == null || tdd <= 0) {
      setState(() {
        _icRatio = null;
        _isf = null;
      });
      return;
    }

    setState(() {
      _icRatio = 500 / tdd;
      _isf = (_rapidActing ? 1800 : 1500) / tdd;
    });
  }

  void _calculateMealDose() {
    final icRatio = _icRatio;
    if (icRatio == null) {
      setState(() => _mealDoseResult = S.computeRatiosFirst);
      return;
    }
    final carbs = double.tryParse(_carbsController.text);
    if (carbs == null || carbs <= 0) {
      setState(() => _mealDoseResult = S.enterCarbs);
      return;
    }
    final units = carbs / icRatio;
    setState(() {
      _mealDoseResult = S.mealDoseResult(
        units.toStringAsFixed(1),
        carbs.toStringAsFixed(0),
        icRatio.toStringAsFixed(0),
      );
    });
  }

  void _calculateCorrectionDose() {
    final isf = _isf;
    if (isf == null) {
      setState(() => _correctionResult = S.computeRatiosFirst);
      return;
    }
    final current = double.tryParse(_currentBgController.text);
    final target = double.tryParse(_targetBgController.text);
    if (current == null || target == null) {
      setState(() => _correctionResult = S.enterCurrentAndTargetBg);
      return;
    }

    final diff = current - target;
    setState(() {
      if (diff.abs() < 1) {
        _correctionResult = S.correctionDoseNone(isf.toStringAsFixed(0));
      } else if (diff > 0) {
        _correctionResult = S.correctionDoseExtra(
          (diff / isf).toStringAsFixed(1),
          diff.toStringAsFixed(0),
          isf.toStringAsFixed(0),
        );
      } else {
        _correctionResult = S.correctionDoseLess(
          (-diff / isf).toStringAsFixed(1),
          (-diff).toStringAsFixed(0),
          isf.toStringAsFixed(0),
        );
      }
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
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Step 1 — TDD in, IC ratio and ISF out.
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
                  FilledButton(onPressed: _calculateRatios, child: Text(S.calculate)),
                  if (_icRatio != null && _isf != null) ...[
                    const SizedBox(height: 24),
                    _ResultCard(text: S.icIsfResult(_icRatio!.toStringAsFixed(0), _isf!.toStringAsFixed(0))),

                    const SizedBox(height: 32),
                    // Step 2 — carbs in this meal -> bolus dose.
                    Text(S.mealDoseTitle, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _carbsController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: S.carbsInMeal,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _calculateMealDose, child: Text(S.calculate)),
                    if (_mealDoseResult != null) ...[
                      const SizedBox(height: 16),
                      _ResultCard(text: _mealDoseResult!),
                    ],

                    const SizedBox(height: 32),
                    // Step 3 — current vs target BG -> correction dose.
                    Text(S.correctionDoseTitle, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _currentBgController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: S.currentBloodGlucoseLabel,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _targetBgController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: S.targetBloodGlucose,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _calculateCorrectionDose, child: Text(S.calculate)),
                    if (_correctionResult != null) ...[
                      const SizedBox(height: 16),
                      _ResultCard(text: _correctionResult!),
                    ],
                  ],
                ],
              ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final String text;
  const _ResultCard({required this.text});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text),
      ),
    );
  }
}

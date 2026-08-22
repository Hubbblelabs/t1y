import 'package:flutter/material.dart';

import '../l10n/strings.dart';

/// Every calculator screen opens with this before any input is shown —
/// the UI must never imply the app independently prescribes a dose (see the
/// UX handoff §23). Returns once the user taps through, or navigates back.
class CalculatorDisclaimer extends StatelessWidget {
  final String calculatorName;
  final VoidCallback onAcknowledge;

  const CalculatorDisclaimer({super.key, required this.calculatorName, required this.onAcknowledge});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.info_outline, size: 48, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              S.calculatorDisclaimerTitle,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              S.calculatorDisclaimerBody(calculatorName),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: onAcknowledge, child: Text(S.iUnderstand)),
          ],
        ),
      ),
    );
  }
}

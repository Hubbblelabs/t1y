import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../widgets/pin_gate.dart';
import 'glucose_entry_screen.dart';

/// Glucose entry, behind the parent's PIN.
class GlucoseSectionScreen extends StatelessWidget {
  const GlucoseSectionScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      PinGate(title: S.glucose, child: const GlucoseEntryScreen());
}

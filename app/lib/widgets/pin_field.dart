import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n/strings.dart';
import '../theme/app_theme.dart';

/// PIN entry: a single field using the device's own number keyboard.
///
/// Replaces the hand-built keypad this screen used to have. A custom keypad
/// looked bespoke but behaved worse — no haptics, no long-press, no system
/// text scaling, and nothing a parent already knows how to use. The native
/// keyboard is the control every other numeric entry on their phone uses.
///
/// The digits are visible rather than dotted out: the threat here is a child
/// tapping through, not a shoulder-surfer, and a parent mistyping a PIN they
/// cannot see is the more likely failure. [obscure] is available for the
/// gate, where the same reasoning doesn't hold as strongly.
class PinField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool enabled;
  final bool autofocus;
  final bool obscure;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onSubmitted;

  const PinField({
    super.key,
    required this.controller,
    required this.label,
    this.enabled = true,
    this.autofocus = false,
    this.obscure = false,
    this.onChanged,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppTheme.deep,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          enabled: enabled,
          autofocus: autofocus,
          obscureText: obscure,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          maxLength: 4,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(4),
          ],
          onChanged: onChanged,
          onSubmitted: (_) => onSubmitted?.call(),
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            letterSpacing: 8,
            color: AppTheme.deep,
          ),
          decoration: InputDecoration(
            hintText: '••••',
            counterText: '',
            helperText: S.pinDigitsHint,
            helperStyle: const TextStyle(fontSize: 11.5),
            // White with a visible edge, like every other place a parent
            // types — never the pale-blue box that read as disabled.
            filled: true,
            fillColor: AppTheme.field,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppTheme.fieldBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppTheme.fieldBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppTheme.primary, width: 1.6),
            ),
          ),
        ),
      ],
    );
  }
}

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
/// The digits are dotted out by default, with an eye on the right to show them
/// — so a parent who mistypes can check what they typed. The eye is per field
/// and resets when the screen closes.
class PinField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final bool enabled;
  final bool autofocus;

  /// Kept for existing callers; every PIN box is hidden until the eye is tapped.
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
  State<PinField> createState() => _PinFieldState();
}

class _PinFieldState extends State<PinField> {
  /// Hidden by default; the eye shows the digits for as long as it is on.
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final label = widget.label;
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
          enabled: widget.enabled,
          autofocus: widget.autofocus,
          obscureText: !_visible,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          maxLength: 4,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(4),
          ],
          onChanged: widget.onChanged,
          onSubmitted: (_) => widget.onSubmitted?.call(),
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            letterSpacing: 8,
            color: AppTheme.deep,
          ),
          decoration: InputDecoration(
            hintText: '••••',
            counterText: '',
            suffixIcon: IconButton(
              tooltip: _visible ? S.hidePin : S.showPin,
              icon: Icon(
                _visible
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                color: AppTheme.inkSoft,
              ),
              onPressed: () => setState(() => _visible = !_visible),
            ),
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

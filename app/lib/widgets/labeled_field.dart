import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A small icon + label sitting above its input box, rather than an icon
/// tucked inside the field — the layout explicitly asked for across the
/// auth screens. Also pins the typed text to solid black; the app's
/// default text theme colour was reading as grey inside `TextField`.
///
/// When focused, scrolls itself into view above the keyboard — needed
/// because the tall wave header above these fields can otherwise leave the
/// field sitting right where the keyboard covers it.
class LabeledField extends StatefulWidget {
  final IconData icon;
  final String label;
  final String hint;
  final TextEditingController controller;
  final bool obscureText;
  final TextInputType? keyboardType;
  final List<String>? autofillHints;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffixIcon;
  final bool readOnly;
  final VoidCallback? onTap;

  const LabeledField({
    super.key,
    required this.icon,
    required this.label,
    required this.hint,
    required this.controller,
    this.obscureText = false,
    this.keyboardType,
    this.autofillHints,
    this.autofocus = false,
    this.onSubmitted,
    this.suffixIcon,
    this.readOnly = false,
    this.onTap,
  });

  @override
  State<LabeledField> createState() => _LabeledFieldState();
}

class _LabeledFieldState extends State<LabeledField> {
  final _fieldKey = GlobalKey();
  final _focusNode = FocusNode();
  late bool _obscured = widget.obscureText;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    if (!_focusNode.hasFocus) return;
    // Wait for the keyboard's open animation to finish resizing the
    // viewport before measuring where this field needs to scroll to.
    Future.delayed(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      final fieldContext = _fieldKey.currentContext;
      if (fieldContext == null) return;
      Scrollable.ensureVisible(
        // ignore: use_build_context_synchronously
        fieldContext,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
        alignment: 0.1,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      key: _fieldKey,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(widget.icon, size: 16, color: AppTheme.deep.withValues(alpha: 0.75)),
            const SizedBox(width: 6),
            Text(
              widget.label,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.deep.withValues(alpha: 0.85)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: widget.controller,
          focusNode: _focusNode,
          obscureText: _obscured,
          keyboardType: widget.keyboardType,
          autofillHints: widget.autofillHints,
          autofocus: widget.autofocus,
          onSubmitted: widget.onSubmitted,
          readOnly: widget.readOnly,
          onTap: widget.onTap,
          style: const TextStyle(color: Colors.black, fontSize: 16),
          cursorColor: AppTheme.primary,
          decoration: InputDecoration(
            hintText: widget.hint,
            suffixIcon: widget.obscureText
                ? IconButton(
                    icon: Icon(
                      _obscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                      color: AppTheme.deep.withValues(alpha: 0.5),
                      size: 20,
                    ),
                    onPressed: () => setState(() => _obscured = !_obscured),
                  )
                : widget.suffixIcon,
          ),
        ),
      ],
    );
  }
}

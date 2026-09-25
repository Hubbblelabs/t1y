import 'package:flutter/material.dart';

/// The one error style used everywhere a form or screen needs to show a
/// failure message — a light pink card with bold red text, rather than the
/// mix of plain red text and ad-hoc red-tinted containers this used to be.
/// Bold and a filled background read as "something needs your attention"
/// more clearly than plain coloured text does.
class ErrorBanner extends StatelessWidget {
  final String message;
  final TextAlign textAlign;

  const ErrorBanner({
    super.key,
    required this.message,
    this.textAlign = TextAlign.start,
  });

  static const _background = Color(0xFFFFE3EC);
  static const _text = Color(0xFFC2185B);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _background,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        textAlign: textAlign,
        style: const TextStyle(
          color: _text,
          fontWeight: FontWeight.w700,
          fontSize: 13,
          height: 1.35,
        ),
      ),
    );
  }
}

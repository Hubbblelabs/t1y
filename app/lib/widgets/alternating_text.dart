import 'dart:async';

import 'package:flutter/material.dart';

/// Switches between English and Tamil every few seconds with a soft fade.
///
/// Used for the headings and descriptions on the screens before sign-in, where
/// the family has not chosen a language yet: one line at a time, taking turns,
/// rather than both stacked. Everything else on those screens is English.
class AlternatingText extends StatefulWidget {
  final String en;
  final String? ta;
  final TextStyle style;
  final TextAlign textAlign;
  final Duration every;

  const AlternatingText(
    this.en,
    this.ta, {
    super.key,
    this.style = const TextStyle(),
    this.textAlign = TextAlign.start,
    this.every = const Duration(seconds: 8),
  });

  @override
  State<AlternatingText> createState() => _AlternatingTextState();
}

class _AlternatingTextState extends State<AlternatingText> {
  Timer? _timer;
  bool _tamil = false;

  bool get _alternates =>
      widget.ta != null && widget.ta!.isNotEmpty && widget.ta != widget.en;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(widget.every, (_) {
      if (mounted && _alternates) setState(() => _tamil = !_tamil);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = (_tamil && _alternates) ? widget.ta! : widget.en;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 600),
      switchInCurve: Curves.easeOut,
      switchOutCurve: Curves.easeIn,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.centerLeft,
        children: [...previous, ?current],
      ),
      child: Text(
        text,
        key: ValueKey(text),
        textAlign: widget.textAlign,
        style: widget.style,
      ),
    );
  }
}

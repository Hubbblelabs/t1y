import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Two-sided card with a 3D Y-axis flip.
///
/// Used for the profile: identity on the front, settings on the back. The
/// back child is pre-rotated a half turn so it reads correctly once the
/// card has turned, and only the visible face is built into the tree at any
/// moment so taps never land on the hidden side.
class FlipCard extends StatefulWidget {
  final Widget front;
  final Widget back;
  final bool showBack;
  final Duration duration;

  const FlipCard({
    super.key,
    required this.front,
    required this.back,
    required this.showBack,
    this.duration = const Duration(milliseconds: 520),
  });

  @override
  State<FlipCard> createState() => _FlipCardState();
}

class _FlipCardState extends State<FlipCard> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
    value: widget.showBack ? 1 : 0,
  );

  @override
  void didUpdateWidget(covariant FlipCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.showBack != oldWidget.showBack) {
      widget.showBack ? _controller.forward() : _controller.reverse();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = Curves.easeInOutCubic.transform(_controller.value);
        final angle = t * math.pi;
        final isBackVisible = t > 0.5;

        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0012) // perspective
            ..rotateY(angle),
          child: isBackVisible
              // Counter-rotate so the back isn't mirrored.
              ? Transform(
                  alignment: Alignment.center,
                  transform: Matrix4.identity()..rotateY(math.pi),
                  child: widget.back,
                )
              : widget.front,
        );
      },
    );
  }
}

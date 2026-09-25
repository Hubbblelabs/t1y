import 'package:flutter/material.dart';

/// A slowly-drifting grid of light lines, tiled infinitely across the
/// canvas — the Flutter equivalent of the animated grid background
/// component supplied as design inspiration. Kept as a low-opacity
/// decorative layer so it reads as texture, not noise, behind foreground
/// content.
class InfiniteGridBackground extends StatefulWidget {
  final Color lineColor;
  final double spacing;

  const InfiniteGridBackground({super.key, this.lineColor = Colors.white, this.spacing = 40});

  @override
  State<InfiniteGridBackground> createState() => _InfiniteGridBackgroundState();
}

class _InfiniteGridBackgroundState extends State<InfiniteGridBackground> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 20))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return CustomPaint(
            painter: _GridPainter(
              progress: _controller.value,
              spacing: widget.spacing,
              color: widget.lineColor,
            ),
            size: Size.infinite,
          );
        },
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  final double progress;
  final double spacing;
  final Color color;

  _GridPainter({required this.progress, required this.spacing, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 0.35)
      ..strokeWidth = 1;
    final offset = spacing * progress;

    for (double x = -spacing + offset; x < size.width + spacing; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = -spacing + offset; y < size.height + spacing; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GridPainter oldDelegate) => oldDelegate.progress != progress;
}

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// The big centre badge on the rewards screen.
///
/// Its halo is driven by [glow] (0-1) — how much of the course the child has
/// actually sat. That makes the screen answer "how far along am I?" at a
/// glance, before any number is read: an untouched course sits flat and
/// grey, a finished one radiates.
///
/// The glow is a *progress* signal, so it also draws a ring around the
/// hexagon showing the same fraction — colour alone is not something to rely
/// on for meaning, and a faint halo is easy to miss in daylight on a cheap
/// screen.
class GlowBadge extends StatefulWidget {
  /// 0-1. Drives halo strength and the progress ring.
  final double glow;

  /// Path to a bundled colour SVG illustration (never a Unicode emoji,
  /// whose artwork varies by device and font) representing the rank, or a
  /// placeholder before the child's first quiz.
  final String icon;

  final List<Color> colors;
  final double size;

  const GlowBadge({
    super.key,
    required this.glow,
    required this.icon,
    required this.colors,
    this.size = 200,
  });

  @override
  State<GlowBadge> createState() => _GlowBadgeState();
}

class _GlowBadgeState extends State<GlowBadge> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 3),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final glow = widget.glow.clamp(0.0, 1.0);

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          // Breathe between 85% and 100% of the target glow, so the badge
          // feels alive without ever pulsing distractingly.
          final pulse = 0.85 + 0.15 * _controller.value;
          return CustomPaint(
            painter: _GlowBadgePainter(
              colors: widget.colors,
              glow: glow,
              pulse: pulse,
            ),
            child: child,
          );
        },
        child: Center(
          // A white disc backs the illustration for the same reason as
          // HexBadge's — full-colour art needs contrast against the badge's
          // own gradient, not a tint that would flatten it to one colour.
          child: Container(
            width: widget.size * 0.44,
            height: widget.size * 0.44,
            padding: EdgeInsets.all(widget.size * 0.045),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: const [
                BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2)),
              ],
            ),
            child: SvgPicture.asset(widget.icon),
          ),
        ),
      ),
    );
  }
}

class _GlowBadgePainter extends CustomPainter {
  final List<Color> colors;
  final double glow;
  final double pulse;

  const _GlowBadgePainter({
    required this.colors,
    required this.glow,
    required this.pulse,
  });

  Path _hexPath(Size size, double inset) {
    final centre = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) / 2) - inset;
    final path = Path();
    for (var i = 0; i < 6; i++) {
      final angle = (math.pi / 3) * i - math.pi / 2;
      final point = Offset(
        centre.dx + radius * math.cos(angle),
        centre.dy + radius * math.sin(angle),
      );
      i == 0 ? path.moveTo(point.dx, point.dy) : path.lineTo(point.dx, point.dy);
    }
    return path..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final centre = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // Halo — scales with progress, so an untouched course barely glows.
    if (glow > 0) {
      canvas.drawCircle(
        centre,
        radius * (0.72 + 0.22 * glow) * pulse,
        Paint()
          ..color = colors.last.withValues(alpha: 0.30 * glow * pulse)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 18 + 18 * glow),
      );
    }

    final badgeSize = Size(size.width * 0.74, size.height * 0.74);
    canvas.save();
    canvas.translate(size.width * 0.13, size.height * 0.13);

    final hex = _hexPath(badgeSize, 0);
    canvas.drawPath(
      hex,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ).createShader(Offset.zero & badgeSize),
    );
    canvas.drawPath(
      _hexPath(badgeSize, badgeSize.width * 0.07),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = badgeSize.width * 0.018
        ..color = Colors.white.withValues(alpha: 0.45),
    );
    canvas.save();
    canvas.clipPath(hex);
    canvas.drawCircle(
      Offset(badgeSize.width * 0.32, badgeSize.height * 0.26),
      badgeSize.width * 0.30,
      Paint()..color = Colors.white.withValues(alpha: 0.16),
    );
    canvas.restore();
    canvas.restore();

    // Progress ring — the same fraction as the halo, but readable rather
    // than atmospheric.
    final ringRect = Rect.fromCircle(center: centre, radius: radius * 0.94);
    canvas.drawArc(
      ringRect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..color = colors.last.withValues(alpha: 0.15),
    );
    if (glow > 0) {
      canvas.drawArc(
        ringRect,
        -math.pi / 2,
        math.pi * 2 * glow,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 5
          ..strokeCap = StrokeCap.round
          ..color = colors.last,
      );
    }
  }

  @override
  bool shouldRepaint(_GlowBadgePainter old) =>
      old.glow != glow || old.pulse != pulse || old.colors != colors;
}

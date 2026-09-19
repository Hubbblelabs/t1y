import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'glow_badge.dart';

/// Full-screen celebration behind a tapped badge — a slowly turning radiant
/// burst on a deep tinted backdrop, with the badge enlarged at its centre.
///
/// Opened via [show], which pushes it as a transparent fade/scale route
/// rather than a plain page — the badge should feel like it is already on
/// screen and simply growing, not like navigating somewhere new.
class BadgeGlowView extends StatefulWidget {
  final String icon;
  final List<Color> colors;
  final double glow;
  final String title;
  final String? subtitle;

  const BadgeGlowView({
    super.key,
    required this.icon,
    required this.colors,
    required this.glow,
    required this.title,
    this.subtitle,
  });

  static Future<void> show(
    BuildContext context, {
    required String icon,
    required List<Color> colors,
    required double glow,
    required String title,
    String? subtitle,
  }) {
    return Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black54,
        transitionDuration: const Duration(milliseconds: 320),
        reverseTransitionDuration: const Duration(milliseconds: 220),
        pageBuilder: (context, _, _) => BadgeGlowView(
          icon: icon,
          colors: colors,
          glow: glow,
          title: title,
          subtitle: subtitle,
        ),
        transitionsBuilder: (context, animation, _, child) => FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween(begin: 0.86, end: 1.0).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutBack),
            ),
            child: child,
          ),
        ),
      ),
    );
  }

  @override
  State<BadgeGlowView> createState() => _BadgeGlowViewState();
}

class _BadgeGlowViewState extends State<BadgeGlowView> with TickerProviderStateMixin {
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 24),
  )..repeat();

  /// Lands the badge with a bounce on first appearance — this view doubles
  /// as the very first thing a child sees straight after finishing a quiz
  /// (see QuizResultScreen), so the entrance itself needs to feel earned
  /// even when nothing pushed it in with its own transition.
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();

  @override
  void dispose() {
    _spin.dispose();
    _entrance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final deep = widget.colors.last;

    return GestureDetector(
      onTap: () => Navigator.of(context).pop(),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Stack(
          alignment: Alignment.center,
          children: [
            // Deep radial backdrop in the badge's own tier colour, so the
            // burst reads as this badge's light rather than a generic effect.
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment.center,
                    radius: 1.1,
                    colors: [deep.withValues(alpha: 0.55), Colors.black.withValues(alpha: 0.88)],
                  ),
                ),
              ),
            ),
            AnimatedBuilder(
              animation: _spin,
              builder: (context, _) => CustomPaint(
                size: Size.infinite,
                painter: _SunburstPainter(
                  color: widget.colors.first,
                  turns: _spin.value,
                ),
              ),
            ),
            SafeArea(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ScaleTransition(
                    scale: CurvedAnimation(parent: _entrance, curve: Curves.elasticOut),
                    child: GlowBadge(
                      glow: widget.glow,
                      icon: widget.icon,
                      colors: widget.colors,
                      size: 260,
                    ),
                  ),
                  const SizedBox(height: 26),
                  Text(
                    widget.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.2,
                    ),
                  ),
                  if (widget.subtitle != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      widget.subtitle!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withValues(alpha: 0.75),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: SafeArea(
                child: IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A slowly rotating fan of translucent rays behind the badge.
class _SunburstPainter extends CustomPainter {
  final Color color;

  /// 0-1, one full turn per animation cycle.
  final double turns;

  const _SunburstPainter({required this.color, required this.turns});

  static const _rayCount = 14;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = Offset(size.width / 2, size.height / 2);
    final length = size.longestSide * 0.75;

    canvas.save();
    canvas.translate(centre.dx, centre.dy);
    canvas.rotate(turns * 2 * math.pi);

    for (var i = 0; i < _rayCount; i++) {
      final angle = (2 * math.pi / _rayCount) * i;
      // Alternate ray width so the burst reads as spokes, not a solid disc.
      final width = i.isEven ? 0.052 : 0.028;
      canvas.save();
      canvas.rotate(angle);
      final path = Path()
        ..moveTo(0, 0)
        ..lineTo(-length * width, -length)
        ..lineTo(length * width, -length)
        ..close();
      canvas.drawPath(
        path,
        Paint()..color = color.withValues(alpha: i.isEven ? 0.14 : 0.07),
      );
      canvas.restore();
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SunburstPainter old) => old.turns != turns || old.color != color;
}

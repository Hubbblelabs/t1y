import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../models/badge.dart';

/// The hexagonal achievement badge used everywhere rewards appear.
///
/// Drawn rather than shipped as artwork so a badge scales cleanly from the
/// 44px chip on the quiz list to the 160px celebration on the result screen,
/// and so an unearned badge is the same shape in grey without needing a
/// second asset per tier.
class HexBadge extends StatelessWidget {
  final BadgeTier? tier;
  final double size;

  /// Text shown in the middle instead of an icon — used for a score like
  /// "96%". Ignored when null; the tier's animal icon (or [noBadgeIcon] when
  /// [tier] is null) is drawn instead.
  final String? label;

  const HexBadge({super.key, required this.tier, this.size = 96, this.label});

  @override
  Widget build(BuildContext context) {
    final earned = tier != null;
    final colors = earned ? tier!.colors : const [Color(0xFFDCE3EA), Color(0xFFB0BEC5)];

    final Widget content = label != null
        ? Text(
            label!,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: size * 0.26,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              height: 1.05,
              shadows: const [
                Shadow(color: Color(0x55000000), blurRadius: 4, offset: Offset(0, 1)),
              ],
            ),
          )
        // A small white disc behind the animal so its full colour
        // illustration reads clearly against the badge's own gradient,
        // rather than being tinted to match it like a plain icon would be.
        : Container(
            width: size * 0.56,
            height: size * 0.56,
            padding: EdgeInsets.all(size * 0.06),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: const [
                BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 1)),
              ],
            ),
            child: SvgPicture.asset(tier?.icon ?? noBadgeIcon),
          );

    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _HexPainter(colors: colors, glow: earned),
        child: Center(child: content),
      ),
    );
  }
}

class _HexPainter extends CustomPainter {
  final List<Color> colors;
  final bool glow;

  const _HexPainter({required this.colors, required this.glow});

  /// A flat-top hexagon inscribed in [size], rotated so two edges are
  /// horizontal — the orientation in the reference artwork.
  Path _hexPath(Size size, double inset) {
    final centre = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) / 2) - inset;
    final path = Path();
    for (var i = 0; i < 6; i++) {
      // -90° start puts a vertex at the top, giving the pointy-top shape.
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
    final outer = _hexPath(size, 0);

    if (glow) {
      canvas.drawPath(
        outer,
        Paint()
          ..color = colors.last.withValues(alpha: 0.35)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
      );
    }

    canvas.drawPath(
      outer,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ).createShader(Offset.zero & size),
    );

    // Inner rim, a shade of the same gradient rather than a separate colour,
    // so the badge reads as one object at every size.
    canvas.drawPath(
      _hexPath(size, size.width * 0.075),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * 0.02
        ..color = Colors.white.withValues(alpha: 0.45),
    );

    // Top-left sheen — a clipped arc, which is what stops the flat gradient
    // from looking like a printed sticker.
    canvas.save();
    canvas.clipPath(outer);
    canvas.drawCircle(
      Offset(size.width * 0.32, size.height * 0.26),
      size.width * 0.30,
      Paint()..color = Colors.white.withValues(alpha: 0.16),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_HexPainter old) => old.colors != colors || old.glow != glow;
}

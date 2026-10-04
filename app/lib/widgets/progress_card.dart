import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../services/glucose_service.dart' show DailyGlucose;
import '../theme/app_theme.dart';

const _bandLow = 70.0;
const _bandHigh = 180.0;

/// Collapses a long history into weekly averages so the curve stays readable.
List<DailyGlucose> _condense(List<DailyGlucose> days) {
  if (days.length <= 60) return days;
  final out = <DailyGlucose>[];
  for (var i = 0; i < days.length; i += 7) {
    final chunk = days.sublist(i, math.min(i + 7, days.length));
    final count = chunk.fold<int>(0, (a, d) => a + d.count);
    final avg =
        chunk.fold<double>(0, (a, d) => a + d.average * d.count) / count;
    out.add(DailyGlucose(chunk.first.day, avg, count));
  }
  return out;
}

String _shortDate(DateTime d) => '${d.day} ${S.monthsShort[d.month - 1]}';

// The graph's palette: the app's blues on a light card.
const _line = AppTheme.primary;
const _ink = AppTheme.inkSoft;
const _good = Color(0xFF2E7D32);
const _watch = Color(0xFFEF6C00);

/// Shown in the graph's place until there is something to draw — readings on
/// two different days — so a new family knows it is coming, not missing.
class GlucoseGraphWaiting extends StatelessWidget {
  const GlucoseGraphWaiting({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        color: const Color(0xFFF1F8FF),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.show_chart_rounded, color: AppTheme.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              S.graphWaiting,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.4,
                color: AppTheme.inkSoft,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The glucose graph: the child's daily average glucose from their first
/// reading to today, drawn as a smooth gradient-filled curve in the app's
/// blues. Tapping a point shows that day's average, how it compares with the
/// day before and whether it is in the usual range.
class GlucoseGraph extends StatefulWidget {
  final List<DailyGlucose> days;

  /// Called with the tapped day, so Home can move its calendar to it.
  final ValueChanged<DateTime>? onDayTapped;

  /// Height of the curve itself (the detail line sits beneath it).
  final double chartHeight;

  /// Draw its own rounded, shadowed card. Off when it sits inside a slide that
  /// already is one.
  final bool framed;

  /// Dragging along the curve scrubs between days.
  final bool scrub;

  /// A day picked elsewhere (the calendar strip): the detail line shows that
  /// day, or the closest earlier one with readings.
  final DateTime? focusDay;

  const GlucoseGraph({
    super.key,
    required this.days,
    this.onDayTapped,
    this.chartHeight = 210,
    this.framed = true,
    this.scrub = true,
    this.focusDay,
  });

  /// The graph needs readings on at least two different days, the first before
  /// today — so a brand-new account shows nothing until a day has passed.
  static bool isReady(List<DailyGlucose> days) {
    if (days.length < 2) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return days.first.day.isBefore(today);
  }

  @override
  State<GlucoseGraph> createState() => _GlucoseGraphState();
}

class _GlucoseGraphState extends State<GlucoseGraph> {
  int? _selected; // null = the latest point

  @override
  void didUpdateWidget(GlucoseGraph old) {
    super.didUpdateWidget(old);
    final day = widget.focusDay;
    if (day != null && day != old.focusDay) {
      final points = _condense(widget.days);
      var index = 0;
      for (var i = 0; i < points.length; i++) {
        if (!points[i].day.isAfter(day)) index = i;
      }
      _selected = index;
    }
  }

  @override
  Widget build(BuildContext context) {
    final points = _condense(widget.days);
    final index = (_selected ?? points.length - 1).clamp(0, points.length - 1);
    final point = points[index];
    final previous = index > 0 ? points[index - 1] : null;

    final chart = LayoutBuilder(
      builder: (context, box) {
        void pick(Offset local) {
          final i = _GraphPainter.nearestIndex(
            local.dx,
            box.maxWidth,
            points.length,
          );
          if (i == _selected) return;
          setState(() => _selected = i);
        }

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (d) {
            pick(d.localPosition);
            final i = _GraphPainter.nearestIndex(
              d.localPosition.dx,
              box.maxWidth,
              points.length,
            );
            widget.onDayTapped?.call(points[i].day);
          },
          onHorizontalDragUpdate: widget.scrub
              ? (d) => pick(d.localPosition)
              : null,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 1000),
            curve: Curves.easeOutCubic,
            builder: (context, t, _) => CustomPaint(
              size: Size(box.maxWidth, box.maxHeight),
              painter: _GraphPainter(
                points: points,
                reveal: t,
                selected: index,
              ),
            ),
          ),
        );
      },
    );

    final content = Column(
      // Framed on its own: a fixed-height curve. Inside a slide: the curve takes
      // whatever height the detail line leaves, so text that wraps (larger
      // text, Tamil) can never push the slide past its edge.
      mainAxisSize: widget.framed ? MainAxisSize.min : MainAxisSize.max,
      children: [
        if (widget.framed)
          SizedBox(height: widget.chartHeight, child: chart)
        else
          Expanded(child: chart),
        const SizedBox(height: 10),
        _DayDetail(point: point, previous: previous),
      ],
    );

    if (!widget.framed) return content;
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 18, 12, 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.white, Color(0xFFF1F8FF)],
        ),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.deep.withValues(alpha: 0.08),
            blurRadius: 22,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: content,
    );
  }
}

/// What the tapped day says: its average, how it moved since the day before,
/// and where it sits against the usual range.
class _DayDetail extends StatelessWidget {
  final DailyGlucose point;
  final DailyGlucose? previous;
  const _DayDetail({required this.point, required this.previous});

  @override
  Widget build(BuildContext context) {
    final avg = point.average.round();
    final band = avg < _bandLow
        ? S.rangeBelow
        : (avg > _bandHigh ? S.rangeAbove : S.rangeIn);
    final bandColor = (avg < _bandLow || avg > _bandHigh) ? _watch : _good;

    String? change;
    Color changeColor = _ink;
    IconData changeIcon = Icons.remove_rounded;
    if (previous != null) {
      final diff = avg - previous!.average.round();
      if (diff == 0) {
        change = S.sameAsBefore;
      } else {
        // Closer to the usual range is the improvement, whichever way the
        // number moved.
        double away(double v) =>
            v < _bandLow ? _bandLow - v : (v > _bandHigh ? v - _bandHigh : 0);
        final better = away(point.average) < away(previous!.average);
        change = diff < 0 ? S.lowerThanBefore(-diff) : S.higherThanBefore(diff);
        changeIcon = diff < 0
            ? Icons.arrow_downward_rounded
            : Icons.arrow_upward_rounded;
        changeColor = better
            ? _good
            : (away(point.average) > away(previous!.average) ? _watch : _ink);
      }
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 180),
      child: Container(
        key: ValueKey('${point.day}-$avg'),
        width: double.infinity,
        margin: const EdgeInsets.only(left: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.lightest.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_shortDate(point.day)}  ·  ${S.readingsCount(point.count)}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: _ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '$avg',
                          style: const TextStyle(
                            fontSize: 26,
                            height: 1.1,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.deep,
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Padding(
                          padding: EdgeInsets.only(bottom: 3),
                          child: Text(
                            'mg/dL',
                            style: TextStyle(fontSize: 12, color: _ink),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Wraps (rather than overflows) when the words are long — larger
            // text, or Tamil.
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (change != null)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(changeIcon, size: 15, color: changeColor),
                        const SizedBox(width: 3),
                        Flexible(
                          child: Text(
                            change,
                            textAlign: TextAlign.end,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: changeColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: 4),
                  Text(
                    band,
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: bandColor,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The curve: dashed gridlines, a smooth gradient-filled line that draws
/// itself in, value labels on the peaks and the latest point, and a glowing
/// marker on the selected day.
class _GraphPainter extends CustomPainter {
  final List<DailyGlucose> points;
  final double reveal;
  final int selected;

  _GraphPainter({
    required this.points,
    required this.reveal,
    required this.selected,
  });

  static const _left = 40.0;
  static const _right = 14.0;
  static const _top = 26.0;
  static const _bottom = 26.0;

  static int nearestIndex(double dx, double width, int n) {
    final plot = width - _left - _right;
    final f = ((dx - _left) / plot).clamp(0.0, 1.0);
    return (f * (n - 1)).round();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final plot = Rect.fromLTRB(
      _left,
      _top,
      size.width - _right,
      size.height - _bottom,
    );
    final values = [for (final p in points) p.average];
    final lo = values.reduce(math.min);
    final hi = values.reduce(math.max);
    final yMin = math.max(0.0, ((lo - 20) / 25).floor() * 25.0);
    final yMax = ((hi + 15) / 25).ceil() * 25.0;

    double x(int i) =>
        plot.left +
        plot.width * (points.length == 1 ? 0.5 : i / (points.length - 1));
    double y(double v) =>
        plot.bottom - plot.height * ((v - yMin) / (yMax - yMin));

    // Dashed gridlines and y labels.
    const steps = 4;
    final grid = Paint()
      ..color = AppTheme.deep.withValues(alpha: 0.12)
      ..strokeWidth = 1;
    for (var i = 0; i <= steps; i++) {
      final v = yMin + (yMax - yMin) * i / steps;
      final gy = y(v);
      _dashedLine(canvas, Offset(plot.left, gy), Offset(plot.right, gy), grid);
      _text(
        canvas,
        v.round().toString(),
        Offset(plot.left - 8, gy),
        size: 11,
        color: _ink,
        align: _Align.right,
        middle: true,
      );
    }
    // The y axis itself.
    canvas.drawLine(
      Offset(plot.left, plot.top - 4),
      Offset(plot.left, plot.bottom),
      Paint()
        ..color = AppTheme.deep.withValues(alpha: 0.2)
        ..strokeWidth = 1,
    );

    // X labels: up to six, evenly spread.
    final labelCount = math.min(6, points.length);
    final xs = <int>{
      for (var k = 0; k < labelCount; k++)
        labelCount == 1
            ? 0
            : (k * (points.length - 1) / (labelCount - 1)).round(),
    };
    for (final i in xs) {
      _text(
        canvas,
        _shortDate(points[i].day),
        Offset(x(i), plot.bottom + 8),
        size: 10.5,
        color: _ink,
        align: i == 0
            ? _Align.left
            : (i == points.length - 1 ? _Align.right : _Align.center),
      );
    }

    // Smooth line (Catmull-Rom → Bézier, control points clamped so the curve
    // never overshoots a real reading).
    final pts = [
      for (var i = 0; i < points.length; i++)
        Offset(x(i), y(points[i].average)),
    ];
    final line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (var i = 0; i < pts.length - 1; i++) {
      final p0 = i == 0 ? pts[i] : pts[i - 1];
      final p1 = pts[i];
      final p2 = pts[i + 1];
      final p3 = i + 2 < pts.length ? pts[i + 2] : p2;
      double clampY(double v) =>
          v.clamp(math.min(p1.dy, p2.dy), math.max(p1.dy, p2.dy));
      final c1 = Offset(
        p1.dx + (p2.dx - p0.dx) / 6,
        clampY(p1.dy + (p2.dy - p0.dy) / 6),
      );
      final c2 = Offset(
        p2.dx - (p3.dx - p1.dx) / 6,
        clampY(p2.dy - (p3.dy - p1.dy) / 6),
      );
      line.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, p2.dx, p2.dy);
    }

    canvas.save();
    canvas.clipRect(
      Rect.fromLTRB(0, 0, plot.left + plot.width * reveal + 2, size.height),
    );

    final area = Path.from(line)
      ..lineTo(pts.last.dx, plot.bottom)
      ..lineTo(pts.first.dx, plot.bottom)
      ..close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppTheme.primary.withValues(alpha: 0.38),
            AppTheme.primary.withValues(alpha: 0.0),
          ],
        ).createShader(plot),
    );
    // A soft glow under the line, then the line itself.
    canvas.drawPath(
      line,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = _line.withValues(alpha: 0.14)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );
    canvas.drawPath(
      line,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..shader = const LinearGradient(
          colors: [AppTheme.primary, AppTheme.deep],
        ).createShader(plot),
    );
    canvas.restore();

    // Value labels on the highest peaks and the latest point, as in the
    // reference: a small dot on the line with the number above it.
    if (reveal > 0.98) {
      final peaks = <int>[];
      for (var i = 1; i < points.length - 1; i++) {
        if (values[i] >= values[i - 1] && values[i] > values[i + 1]) {
          peaks.add(i);
        }
      }
      peaks.sort((a, b) => values[b].compareTo(values[a]));
      final labelled = <int>[points.length - 1];
      for (final i in peaks) {
        if (labelled.length >= 4) break;
        if (labelled.every((j) => (x(j) - x(i)).abs() > 34)) labelled.add(i);
      }
      for (final i in labelled) {
        canvas.drawCircle(pts[i], 3.6, Paint()..color = AppTheme.deep);
        _text(
          canvas,
          values[i].round().toString(),
          Offset(pts[i].dx, pts[i].dy - 20),
          size: 12,
          color: AppTheme.deep,
          align: _Align.center,
          bold: true,
        );
      }

      // Selected day: guide line and glowing marker.
      final p = pts[selected.clamp(0, pts.length - 1)];
      canvas.drawLine(
        Offset(p.dx, plot.top),
        Offset(p.dx, plot.bottom),
        Paint()
          ..color = AppTheme.deep.withValues(alpha: 0.25)
          ..strokeWidth = 1.2,
      );
      canvas.drawCircle(p, 11, Paint()..color = _line.withValues(alpha: 0.2));
      canvas.drawCircle(p, 6, Paint()..color = AppTheme.deep);
      canvas.drawCircle(p, 2.6, Paint()..color = Colors.white);
    }
  }

  void _dashedLine(Canvas canvas, Offset a, Offset b, Paint paint) {
    const dash = 6.0;
    const gap = 5.0;
    var x = a.dx;
    while (x < b.dx) {
      canvas.drawLine(
        Offset(x, a.dy),
        Offset(math.min(x + dash, b.dx), a.dy),
        paint,
      );
      x += dash + gap;
    }
  }

  void _text(
    Canvas canvas,
    String text,
    Offset at, {
    required double size,
    required Color color,
    required _Align align,
    bool middle = false,
    bool bold = false,
  }) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: size,
          color: color,
          fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = switch (align) {
      _Align.left => at.dx - 4,
      _Align.center => at.dx - tp.width / 2,
      _Align.right => at.dx - tp.width,
    };
    tp.paint(canvas, Offset(dx, middle ? at.dy - tp.height / 2 : at.dy));
  }

  @override
  bool shouldRepaint(_GraphPainter old) =>
      old.reveal != reveal || old.selected != selected || old.points != points;
}

enum _Align { left, center, right }

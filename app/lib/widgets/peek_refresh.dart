import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../theme/app_theme.dart';

/// Pull-to-refresh with a character: as the screen is dragged down, a little
/// tiny robot peeks up from behind the content, and letting go after a
/// real pull refreshes. It shows only while pulling or loading — never at rest.
///
/// [child] must be a vertical scrollable whose physics allow overscroll on
/// every platform — `AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics())`.
class PeekRefresh extends StatefulWidget {
  final Future<void> Function() onRefresh;
  final Widget child;

  const PeekRefresh({super.key, required this.onRefresh, required this.child});

  @override
  State<PeekRefresh> createState() => _PeekRefreshState();
}

class _PeekRefreshState extends State<PeekRefresh>
    with SingleTickerProviderStateMixin {
  /// How far to drag before letting go refreshes.
  static const _trigger = 64.0;

  /// The space the character keeps while the refresh runs.
  static const _hold = 52.0;

  /// Far beyond any real pull — only a safety stop. The robot rides the top
  /// edge of the content for the whole drag.
  static const _maxPull = 600.0;

  /// Drives the blinking, glancing and waving — and only runs while the
  /// character is actually on screen.
  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  double _pull = 0;
  double _peak = 0;
  bool _refreshing = false;

  /// The refresh has finished: the robot stays out a moment, smiling, before
  /// it tucks away.
  bool _done = false;

  @override
  void dispose() {
    _loop.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0) return false;
    final m = n.metrics;

    if (n is ScrollStartNotification) {
      _peak = 0;
    }
    if (n is ScrollUpdateNotification || n is OverscrollNotification) {
      final over = (m.minScrollExtent - m.pixels).clamp(0.0, _maxPull);
      if (!_refreshing) _peak = math.max(_peak, over);
      if ((over - _pull).abs() > 0.5) setState(() => _pull = over);
    }
    // The finger came up: refresh if the drag went far enough.
    if (n is UserScrollNotification && n.direction == ScrollDirection.idle) {
      if (_peak >= _trigger && !_refreshing) _start();
      _peak = 0;
    }
    return false;
  }

  Future<void> _start() async {
    setState(() => _refreshing = true);
    final started = DateTime.now();
    try {
      await widget.onRefresh();
    } finally {
      // Long enough to see the character, however quick the reload was.
      final spent = DateTime.now().difference(started);
      if (spent < const Duration(milliseconds: 1100)) {
        await Future<void>.delayed(const Duration(milliseconds: 1100) - spent);
      }
      if (mounted) {
        setState(() => _done = true);
        await Future<void>.delayed(const Duration(milliseconds: 1000));
        if (mounted) {
          setState(() {
            _refreshing = false;
            _done = false;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Only a deliberate pull (or a running refresh) brings the icon out; the
    // little bounce of ordinary scrolling at the top must not.
    final shown = _refreshing || _pull > 18;
    final height = shown ? (_refreshing ? _hold : 0) + _pull : 0.0;

    final visible = shown;
    if (visible && !_loop.isAnimating) {
      _loop.repeat();
    } else if (!visible && _loop.isAnimating) {
      _loop.stop();
    }

    return Stack(
      children: [
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: height,
          child: ClipRect(
            child: AnimatedBuilder(
              animation: _loop,
              builder: (context, _) => _Peek(
                height: height,
                trigger: _trigger,
                phase: _loop.value,
                refreshing: _refreshing && !_done,
                done: _done,
              ),
            ),
          ),
        ),
        NotificationListener<ScrollNotification>(
          onNotification: _onScroll,
          child: AnimatedPadding(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            padding: EdgeInsets.only(top: _refreshing ? _hold : 0),
            child: widget.child,
          ),
        ),
      ],
    );
  }
}

class _Peek extends StatelessWidget {
  final double height;
  final double trigger;
  final double phase;
  final bool refreshing;

  /// Finished loading — smile.
  final bool done;

  const _Peek({
    required this.height,
    required this.trigger,
    required this.phase,
    required this.refreshing,
    required this.done,
  });

  @override
  Widget build(BuildContext context) {
    // 0 → hidden behind the content, 1 → fully out.
    final t = (height / trigger).clamp(0.0, 1.0);
    const size = 40.0;
    const robotHeight = 32.0;

    return Align(
      alignment: Alignment.bottomCenter,
      child: Transform.translate(
        offset: Offset(0, (1 - t) * robotHeight),
        child: CustomPaint(
          size: const Size(size, robotHeight),
          painter: _RobotPainter(
            phase: phase,
            // How far out it is, 0..1 — the eyes open wider
            // as the pull grows.
            pull: t,
            // Beams once it can be let go — and again when the refresh is done.
            ready: done || (!refreshing && height >= trigger),
            busy: refreshing,
          ),
        ),
      ),
    );
  }
}

/// A small robot peeking over the edge of the content: a rounded head, a dark
/// screen for a face with glowing eyes, side bolts and two hands gripping the
/// edge. It reacts to the pull — the eyes open wider as you drag; when you can
/// let go it beams and waves; while loading its eyes scan side to side.
class _RobotPainter extends CustomPainter {
  final double phase; // 0..1, looping
  final double pull; // 0..1
  final bool ready;
  final bool busy;

  _RobotPainter({
    required this.phase,
    required this.pull,
    required this.ready,
    required this.busy,
  });

  static const _screen = Color(0xFF0D2A57);
  static const _glow = Color(0xFF4FC3F7);

  @override
  void paint(Canvas canvas, Size size) {
    // Drawn on a 40 x 32 grid (the head, shifted up to the top) and scaled to fit.
    canvas.scale(size.width / 40, size.height / 32);
    canvas.translate(0, -8);

    // Side bolts.
    final bolt = Paint()..color = AppTheme.primary;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(0.8, 21, 3.4, 7),
        const Radius.circular(1.7),
      ),
      bolt,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(35.8, 21, 3.4, 7),
        const Radius.circular(1.7),
      ),
      bolt,
    );

    // Head.
    final head = RRect.fromRectAndRadius(
      const Rect.fromLTWH(3.6, 12.5, 32.8, 26), // sits on the bottom edge
      const Radius.circular(10),
    );
    canvas.drawShadow(
      Path()..addRRect(head),
      AppTheme.deep.withValues(alpha: 0.3),
      1.5,
      false,
    );
    canvas.drawRRect(
      head,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.white, Color(0xFFD7E9FF)],
        ).createShader(head.outerRect),
    );
    canvas.drawRRect(
      head,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = AppTheme.deep,
    );

    // Face screen.
    final face = RRect.fromRectAndRadius(
      const Rect.fromLTWH(7.4, 16.2, 25.2, 15.6),
      const Radius.circular(6.5),
    );
    canvas.drawRRect(face, Paint()..color = _screen);

    // Eyes: they widen with the pull, scan while loading, and blink now and then.
    final blink = (phase > 0.9 && phase < 0.96) ? 0.2 : 1.0;
    final look = busy ? math.sin(phase * 2 * math.pi) * 1.8 : 0.0;
    final eyeH = (3.2 + 2.4 * pull) * blink;
    final eyeW = 3.6 + 1.0 * pull;
    for (final x in [14.6, 25.4]) {
      final eye = RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(x + look, 22.4),
          width: eyeW,
          height: eyeH,
        ),
        Radius.circular(eyeW / 2),
      );
      canvas.drawRRect(
        eye,
        Paint()
          ..color = _glow.withValues(alpha: 0.28)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.6),
      );
      canvas.drawRRect(eye, Paint()..color = _glow);
    }

    // Mouth: a thin line that curls into a smile when it can let go.
    final mouth = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round
      ..color = _glow;
    if (ready) {
      canvas.drawArc(
        Rect.fromCenter(center: const Offset(20, 27.2), width: 8.4, height: 5),
        0.2,
        math.pi - 0.4,
        false,
        mouth,
      );
    } else {
      canvas.drawLine(const Offset(17.4, 28), const Offset(22.6, 28), mouth);
    }

    // Hands gripping the edge; they wave when it is ready.
    final wave = ready ? math.sin(phase * 4 * math.pi) * 2.2 : 0.0;
    final hand = Paint()..color = Colors.white;
    final handLine = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = AppTheme.deep;
    for (final side in [-1.0, 1.0]) {
      final c = Offset(
        20 + side * 17.2,
        38.4 - (side > 0 ? wave : -wave).abs(),
      );
      canvas.drawCircle(c, 2.3, hand);
      canvas.drawCircle(c, 2.3, handLine);
    }
  }

  @override
  bool shouldRepaint(_RobotPainter old) =>
      old.phase != phase ||
      old.pull != pull ||
      old.ready != ready ||
      old.busy != busy;
}

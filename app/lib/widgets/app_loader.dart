import 'dart:math';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The app's own loading indicator — a row of bars bouncing up and down
/// like an equaliser, in the app's own blue palette, instead of a spinner
/// going round and round. Stands in for the plain platform spinner on every
/// full-screen "loading" state.
///
/// Not used for the small in-button spinners (those stay a plain white
/// [CircularProgressIndicator] sized to the button) — only where a whole
/// screen or panel is waiting on something.
class AppLoader extends StatefulWidget {
  final double size;
  final String? label;

  const AppLoader({super.key, this.size = 36, this.label});

  @override
  State<AppLoader> createState() => _AppLoaderState();
}

class _AppLoaderState extends State<AppLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  // Each bar bounces on its own phase offset so the row reads as a wave
  // passing through, not four bars ticking in lockstep.
  static const _phases = [0.0, 0.18, 0.36, 0.54];
  static const _colors = [
    AppTheme.deep,
    AppTheme.primary,
    AppTheme.primary,
    AppTheme.accent,
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final barWidth = widget.size * 0.14;
    final gap = widget.size * 0.10;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: widget.size,
          height: widget.size,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  for (var i = 0; i < _phases.length; i++) ...[
                    if (i > 0) SizedBox(width: gap),
                    _Bar(
                      width: barWidth,
                      maxHeight: widget.size,
                      color: _colors[i],
                      // 0..1..0 per bar, offset so the bars ripple rather
                      // than pulse together.
                      level:
                          0.22 +
                          0.78 *
                              (0.5 -
                                  0.5 *
                                      cos(
                                        (_controller.value + _phases[i]) *
                                            2 *
                                            pi,
                                      )),
                    ),
                  ],
                ],
              );
            },
          ),
        ),
        if (widget.label != null) ...[
          const SizedBox(height: 14),
          Text(
            widget.label!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.inkSoft,
            ),
          ),
        ],
      ],
    );
  }
}

class _Bar extends StatelessWidget {
  final double width;
  final double maxHeight;
  final double level;
  final Color color;

  const _Bar({
    required this.width,
    required this.maxHeight,
    required this.level,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final height = (maxHeight * level).clamp(maxHeight * 0.16, maxHeight);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(width / 2),
      ),
    );
  }
}

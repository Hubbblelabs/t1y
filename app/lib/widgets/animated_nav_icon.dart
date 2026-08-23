import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// One reusable animated icon for every bottom-nav tab, per the UX handoff
/// §13 — not separate animation logic per item.
///
/// Selecting a tab plays a short springy "pop": the icon lifts, overshoots
/// its resting scale and settles, while a soft halo fades in behind it. The
/// previous version only cross-faded outlined→filled and scaled 1.0→1.1,
/// which read as static in use.
class AnimatedNavIcon extends StatefulWidget {
  final IconData icon;
  final IconData activeIcon;
  final bool isSelected;

  const AnimatedNavIcon({
    super.key,
    required this.icon,
    required this.activeIcon,
    required this.isSelected,
  });

  @override
  State<AnimatedNavIcon> createState() => _AnimatedNavIconState();
}

class _AnimatedNavIconState extends State<AnimatedNavIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
    value: widget.isSelected ? 1 : 0,
  );

  late final Animation<double> _pop = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutBack, // overshoot on the way in
    reverseCurve: Curves.easeOut,
  );

  @override
  void didUpdateWidget(covariant AnimatedNavIcon oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isSelected != oldWidget.isSelected) {
      widget.isSelected ? _controller.forward() : _controller.reverse();
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
      animation: _pop,
      builder: (context, _) {
        final t = _pop.value.clamp(0.0, 1.4);
        return SizedBox(
          width: 46,
          height: 34,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Halo grows in behind the selected icon.
              Opacity(
                opacity: (t * 0.9).clamp(0.0, 1.0),
                child: Transform.scale(
                  scale: 0.5 + t * 0.5,
                  child: Container(
                    width: 44,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              Transform.translate(
                offset: Offset(0, -2 * t),
                child: Transform.scale(
                  scale: 1 + 0.16 * t,
                  child: Icon(
                    widget.isSelected ? widget.activeIcon : widget.icon,
                    color: Color.lerp(
                      AppTheme.deep.withValues(alpha: 0.55),
                      AppTheme.primary,
                      t.clamp(0.0, 1.0),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

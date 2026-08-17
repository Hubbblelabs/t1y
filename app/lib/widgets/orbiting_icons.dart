import 'dart:math';

import 'package:flutter/material.dart';

/// Icons/avatars drifting in a slow circular orbit around a centred badge —
/// the Get Started screen's visual anchor. Deliberately slow (60s per
/// revolution) so it reads as ambient motion, not an animation demanding
/// attention.
class OrbitingIcons extends StatefulWidget {
  final Widget center;
  final List<IconData> icons;
  final double radius;
  final Color ringColor;
  final Color badgeFill;
  final Color badgeBorder;
  final Color iconColor;

  const OrbitingIcons({
    super.key,
    required this.center,
    required this.icons,
    this.radius = 130,
    this.ringColor = const Color(0x24FFFFFF),
    this.badgeFill = const Color(0x14FFFFFF),
    this.badgeBorder = const Color(0x29FFFFFF),
    this.iconColor = Colors.white,
  });

  @override
  State<OrbitingIcons> createState() => _OrbitingIconsState();
}

class _OrbitingIconsState extends State<OrbitingIcons> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 60))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.radius * 2 + 64;
    return SizedBox(
      width: size,
      height: size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          final baseAngle = _controller.value * 2 * pi;
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: widget.radius * 2,
                height: widget.radius * 2,
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: widget.ringColor, width: 1)),
              ),
              for (var i = 0; i < widget.icons.length; i++)
                Transform.translate(
                  offset: Offset(
                    widget.radius * cos(baseAngle + (2 * pi * i / widget.icons.length)),
                    widget.radius * sin(baseAngle + (2 * pi * i / widget.icons.length)),
                  ),
                  child: _OrbitBadge(
                    icon: widget.icons[i],
                    fill: widget.badgeFill,
                    border: widget.badgeBorder,
                    iconColor: widget.iconColor,
                  ),
                ),
              widget.center,
            ],
          );
        },
      ),
    );
  }
}

class _OrbitBadge extends StatelessWidget {
  final IconData icon;
  final Color fill;
  final Color border;
  final Color iconColor;

  const _OrbitBadge({required this.icon, required this.fill, required this.border, required this.iconColor});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(color: fill, shape: BoxShape.circle, border: Border.all(color: border)),
      child: Icon(icon, color: iconColor, size: 22),
    );
  }
}

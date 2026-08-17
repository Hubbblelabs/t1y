import 'package:flutter/material.dart';

/// One reusable animated icon for every bottom-nav tab, per the UX handoff
/// §13 — not separate animation logic per item. Base -> active is a short
/// scale + opacity transition (150–250ms).
class AnimatedNavIcon extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: isSelected ? 1.1 : 1.0,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: Icon(
          isSelected ? activeIcon : icon,
          key: ValueKey(isSelected),
        ),
      ),
    );
  }
}

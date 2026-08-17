import 'dart:math';

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Shared blue header band with a wavy bottom edge and soft decorative
/// circles, used across the auth screens (email entry, login, signup).
/// Keeps every auth screen visually consistent instead of each one
/// reinventing its own top treatment. The circles drift gently up and down
/// so the header doesn't feel static.
class WaveHeader extends StatefulWidget {
  final String title;
  final String? subtitle;
  final bool showBack;
  final double height;

  const WaveHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.showBack = true,
    this.height = 300,
  });

  @override
  State<WaveHeader> createState() => _WaveHeaderState();
}

class _WaveHeaderState extends State<WaveHeader> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 6))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height,
      child: Stack(
        children: [
          ClipPath(
            clipper: _WaveClipper(),
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppTheme.primary, AppTheme.deep],
                ),
              ),
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, _) {
                  final t = _controller.value * 2 * pi;
                  return Stack(
                    children: [
                      Positioned(
                        top: -30 + sin(t) * 6,
                        right: -20,
                        child: _dot(120, 0.10),
                      ),
                      Positioned(
                        top: 40 + sin(t + pi / 2) * 8,
                        right: 60,
                        child: _dot(14, 0.35),
                      ),
                      Positioned(
                        top: 90 + sin(t + pi) * 6,
                        right: 20,
                        child: _dot(28, 0.20),
                      ),
                      Positioned(
                        bottom: 70 + sin(t + pi / 3) * 8,
                        left: -30,
                        child: _dot(90, 0.10),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
         SafeArea(
  child: Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (widget.showBack)
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      alignment: Alignment.centerLeft,
                     padding: EdgeInsets.zero,
                    )
                  else
                    const SizedBox(height: 8),
                  const Spacer(),
                  Text(
                    widget.title,
                    style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800, height: 1.1),
                  ),
                  if (widget.subtitle != null) ...[
                    const SizedBox(height: 15),
                    Text(
                      widget.subtitle!,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 14),
                    ),
                  ],
                  const SizedBox(height: 48),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dot(double size, double opacity) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: opacity)),
    );
  }
}

class _WaveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path()..lineTo(0, size.height - 40);
    path.quadraticBezierTo(size.width * 0.25, size.height, size.width * 0.5, size.height - 24);
    path.quadraticBezierTo(size.width * 0.75, size.height - 48, size.width, size.height - 12);
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

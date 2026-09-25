import 'package:flutter/material.dart';

/// The app's heart + leaf-sprig mark — the exact artwork supplied, shipped
/// as a bundled asset (alpha-only PNG) so it can be tinted per-theme via a
/// ColorFilter without needing separate light/dark exports.
class AppLogo extends StatelessWidget {
  final double size;
  final Color color;

  const AppLogo({super.key, this.size = 64, this.color = const Color(0xFF0D47A1)});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/logo.png',
      width: size,
      color: color,
      colorBlendMode: BlendMode.srcIn,
      fit: BoxFit.contain,
    );
  }
}

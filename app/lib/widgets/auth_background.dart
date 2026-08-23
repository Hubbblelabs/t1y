import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Shared backdrop for the sign-in/sign-up screens: a white-to-light-blue
/// gradient.
///
/// Forces itself to fill the full available space via `BoxConstraints.
/// expand()` — a plain `DecoratedBox` only sizes to its child (the
/// scrollable form content), which left the gradient stopping short of the
/// screen's bottom on any form shorter than the viewport, with the
/// Scaffold's own flat background showing through below it.
class AuthBackground extends StatelessWidget {
  final Widget child;
  const AuthBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints.expand(),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.white, AppTheme.accent],
        ),
      ),
      child: child,
    );
  }
}

import 'package:flutter/material.dart';

/// A slower, quieter page transition than the platform default — used
/// specifically for sign-in → password, where the ordinary fast slide felt
/// abrupt. Slides in from the right while fading in, with a longer duration
/// and a gentle curve rather than the default's snappier one.
class SlowSlideRoute<T> extends PageRouteBuilder<T> {
  SlowSlideRoute({required WidgetBuilder builder})
    : super(
        pageBuilder: (context, animation, secondaryAnimation) =>
            builder(context),
        transitionDuration: const Duration(milliseconds: 520),
        reverseTransitionDuration: const Duration(milliseconds: 420),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeInOutCubic,
            reverseCurve: Curves.easeInCubic,
          );
          return FadeTransition(
            opacity: curved,
            child: SlideTransition(
              position: Tween(
                begin: const Offset(0.12, 0),
                end: Offset.zero,
              ).animate(curved),
              child: child,
            ),
          );
        },
      );
}

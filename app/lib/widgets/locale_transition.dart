import 'package:flutter/material.dart';

import '../providers/app_state.dart';

/// Switches the whole app to the new language in one smooth step.
///
/// Every screen reads its words from `S`, which is not an inherited widget, so
/// Flutter has no way to know a `const` screen further down needs rebuilding
/// when the language changes. That is why some screens used to stay in the old
/// language until they were refreshed. This sits above every route and, on a
/// language change, dims the app briefly, rebuilds every widget below it in
/// the new language, and fades back in — a glide rather than a flicker.
class LocaleTransition extends StatefulWidget {
  final Widget child;

  const LocaleTransition({super.key, required this.child});

  @override
  State<LocaleTransition> createState() => _LocaleTransitionState();
}

class _LocaleTransitionState extends State<LocaleTransition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 170),
    reverseDuration: const Duration(milliseconds: 260),
    value: 1,
  );

  late String _locale = AppState.instance.locale;

  @override
  void initState() {
    super.initState();
    AppState.instance.addListener(_onLocaleChanged);
  }

  @override
  void dispose() {
    AppState.instance.removeListener(_onLocaleChanged);
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onLocaleChanged() async {
    final next = AppState.instance.locale;
    if (next == _locale) return;
    _locale = next;

    await _controller.animateTo(0.25, curve: Curves.easeOut);
    if (!mounted) return;
    _rebuildEverything();
    await _controller.animateTo(1, curve: Curves.easeOutCubic);
  }

  /// Marks every element below this one dirty, so each screen — including the
  /// ones kept alive off-screen and the ones under the current route — builds
  /// again and reads its words in the new language.
  void _rebuildEverything() {
    void rebuild(Element element) {
      element.markNeedsBuild();
      element.visitChildren(rebuild);
    }

    (context as Element).visitChildren(rebuild);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final t = _controller.value;
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 6),
            child: child,
          ),
        );
      },
    );
  }
}

import 'package:flutter/material.dart';

import '../providers/app_state.dart';

/// Mixin for screens whose content is locale-specific.
///
/// The language toggle in [AppHeader] only flipped [AppState]'s value and
/// warmed the caches — screens that had resolved their data future in
/// `initState` kept showing whatever locale was active when they were first
/// built, so switching to Tamil left the Help Book in English until a cold
/// restart. This wires each screen to [AppState] so a locale change
/// re-resolves its data immediately.
///
/// Implement [onLocaleChanged] to rebuild whatever future/state the screen
/// holds; it is called only when the locale actually differs from the one
/// the screen last loaded with.
mixin LocaleAware<T extends StatefulWidget> on State<T> {
  late String _loadedLocale;

  /// The locale this screen's currently-displayed data was loaded for.
  String get loadedLocale => _loadedLocale;

  @override
  void initState() {
    super.initState();
    _loadedLocale = AppState.instance.locale;
    AppState.instance.addListener(_handleLocaleChange);
  }

  @override
  void dispose() {
    AppState.instance.removeListener(_handleLocaleChange);
    super.dispose();
  }

  void _handleLocaleChange() {
    final current = AppState.instance.locale;
    if (current == _loadedLocale || !mounted) return;
    _loadedLocale = current;
    onLocaleChanged(current);
  }

  /// Called when the active locale changes. Re-resolve the screen's data
  /// here — typically `setState(() => _future = ...load(locale))`.
  void onLocaleChanged(String locale);
}

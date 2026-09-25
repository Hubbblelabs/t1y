import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Central theme for T1D Prajana Yandra.
///
/// Palette is the four supplied blues — light-to-dark, used consistently as
/// surface -> accent -> primary -> ink, not picked per-screen:
///   #E3F2FD  lightest surface / soft backgrounds
///   #90CAF9  secondary accent / disabled-ish states
///   #2196F3  primary — buttons, active states, links
///   #0D47A1  deep ink — headings, the dark "Login" button, high-emphasis text
///
/// Font is Poppins (Google Fonts) — substituted for "Elms Sans", which isn't
/// a font that exists in the Google Fonts catalog (GoogleFonts.elmsSans()
/// would throw at runtime). Poppins was already the fallback typeface
/// decided for this app; flag if a different family was actually intended.
class AppTheme {
  AppTheme._();

  static const Color lightest = Color(0xFFE3F2FD);
  static const Color accent = Color(0xFF90CAF9);
  static const Color primary = Color(0xFF2196F3);
  static const Color deep = Color(0xFF0D47A1);

  /// Text colours. Secondary text used to be black at 40–60% opacity, which
  /// read as washed-out grey on a phone in daylight; these are solid, dark
  /// shades instead — [ink] for primary text, [inkSoft] for anything that
  /// only needs to read as secondary.
  static const Color ink = Color(0xFF111827);
  static const Color inkSoft = Color(0xFF374151);

  /// Where a parent types. Always white, with a visible edge, so an entry
  /// field never looks like a disabled or read-only box.
  static const Color field = Colors.white;
  static const Color fieldBorder = Color(0xFFB6C7DC);

  static TextTheme _textTheme(Brightness brightness) {
    final base = brightness == Brightness.dark
        ? ThemeData.dark().textTheme
        : ThemeData.light().textTheme;
    final theme = GoogleFonts.poppinsTextTheme(base);
    // Force near-black body text in light mode — the Material 3 seeded
    // colour scheme's default onSurface reads as a washed-out grey, which
    // made typed input look disabled/unreadable.
    return brightness == Brightness.dark
        ? theme
        : theme.apply(
            bodyColor: ink,
            displayColor: ink,
          );
  }

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.light,
      primary: primary,
      onPrimary: Colors.white,
      secondary: accent,
      surface: Colors.white,
      surfaceContainerLowest: lightest,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: lightest,
      textTheme: _textTheme(Brightness.light),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: deep,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: deep,
        ),
      ),
      cardTheme: const CardThemeData(
        elevation: 0,
        margin: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: deep,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(58),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          textStyle: GoogleFonts.poppins(
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          minimumSize: const Size.fromHeight(52),
          side: const BorderSide(color: primary, width: 1.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          textStyle: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      // No double shade under the selected tab: the icon draws its own halo
      // (see AnimatedNavIcon), so Material's indicator pill is switched off.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? primary : inkSoft,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: field,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: fieldBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: fieldBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: primary, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: scheme.error, width: 1.4),
        ),
        hintStyle: GoogleFonts.poppins(color: inkSoft.withValues(alpha: 0.75)),
        labelStyle: GoogleFonts.poppins(color: inkSoft),
      ),
    );
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: Brightness.dark,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      textTheme: _textTheme(Brightness.dark),
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
    );
  }
}

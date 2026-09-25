import 'dart:async';

import 'package:flutter/material.dart';

import '../providers/app_state.dart';
import '../services/content_service.dart';
import '../theme/app_theme.dart';

/// Sliding EN / தமிழ் pill.
///
/// Reusable so the toggle is available wherever content is language-specific
/// — the header, the Terms screen at the moment of consent, and inside a
/// topic — rather than only on list screens. Switching warms the other
/// locale's cache in the background so the change lands instantly.
/// One half of the track; the pill and each label are this wide.
const double _segmentWidth = 46;
const double _trackWidth = _segmentWidth * 2;

class LanguageToggle extends StatelessWidget {
  /// Renders light-on-dark, for use over the blue headers.
  final bool onDark;

  const LanguageToggle({super.key, this.onDark = false});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) {
        final isTamil = AppState.instance.isTamil;
        final trackColor = onDark
            ? Colors.white.withValues(alpha: 0.18)
            : AppTheme.lightest;
        final activeColor = onDark ? Colors.white : AppTheme.primary;
        final activeText = onDark ? AppTheme.deep : Colors.white;
        final inactiveText = onDark
            ? Colors.white.withValues(alpha: 0.85)
            : AppTheme.deep.withValues(alpha: 0.65);

        return GestureDetector(
          onTap: () async {
            final next = isTamil ? 'en' : 'ta';
            await AppState.instance.setLocale(next);
            // Fire-and-forget: screens listen to AppState and re-resolve from
            // cache immediately; this just makes sure the cache is fresh.
            // Offline failures are fine — the cached copy still renders.
            unawaited(
              ContentService.instance
                  .getTopics(next, forceRefresh: true)
                  .then((_) {}, onError: (_) {}),
            );
          },
          child: Container(
            // Width MUST be explicit. Without it the Stack's AnimatedAlign
            // (an Align, which expands to the maximum width it is offered)
            // stretched to whatever the AppBar's action Row allowed, so the
            // sliding pill aligned to the far edge of an oversized box
            // instead of the 92px track — the toggle looked frozen.
            width: _trackWidth + 6,
            height: 32,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: trackColor,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Stack(
              children: [
                AnimatedAlign(
                  duration: const Duration(milliseconds: 240),
                  curve: Curves.easeOutCubic,
                  alignment: isTamil ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    width: _segmentWidth,
                    height: 26,
                    decoration: BoxDecoration(
                      color: activeColor,
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _Label(
                      text: 'EN',
                      color: isTamil ? inactiveText : activeText,
                    ),
                    _Label(
                      text: 'தமிழ்',
                      color: isTamil ? activeText : inactiveText,
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  final Color color;

  const _Label({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _segmentWidth,
      height: 26,
      child: Center(
        child: AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 200),
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: color,
          ),
          child: Text(text),
        ),
      ),
    );
  }
}

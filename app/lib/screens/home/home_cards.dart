import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/glucose_reading.dart';
import '../../theme/app_theme.dart';

/// The band colours the Health tab's dial already uses, so a low, in-range or
/// high day reads the same wherever it appears.
Color bandColour(double value) {
  if (value < 70) return const Color(0xFFE53935);
  if (value > 180) return const Color(0xFFEF6C00);
  return const Color(0xFF2E7D32);
}

/// Averages readings into one number per day.
///
/// Days with no readings are simply absent from the result: an empty day is
/// "nothing recorded", never a zero, and the chart draws it as such.
Map<DateTime, double> dailyAverages(List<GlucoseReading> readings) {
  final sums = <DateTime, List<double>>{};
  for (final reading in readings) {
    final t = reading.measuredAt;
    sums
        .putIfAbsent(DateTime(t.year, t.month, t.day), () => [])
        .add(reading.value);
  }
  return {
    for (final entry in sums.entries)
      entry.key: entry.value.reduce((a, b) => a + b) / entry.value.length,
  };
}

/// Seven bars, one per day of the current week, each the day's average glucose.
///
/// Tapping a bar selects that day, the same as tapping it in the week strip
/// above, so the two stay one control seen two ways.
class WeekTrendCard extends StatelessWidget {
  final List<DateTime> days;
  final Map<DateTime, double> averages;
  final DateTime selected;
  final List<String> dayLabels;
  final ValueChanged<DateTime> onSelect;

  const WeekTrendCard({
    super.key,
    required this.days,
    required this.averages,
    required this.selected,
    required this.dayLabels,
    required this.onSelect,
  });

  static const _tallest = 300.0;
  static const _chartHeight = 92.0;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            S.thisWeek,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppTheme.deep,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: _chartHeight + 30,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < days.length; i++)
                  Expanded(child: _bar(days[i], dayLabels[i])),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            S.glucoseTargetsNote,
            style: TextStyle(
              fontSize: 10.5,
              height: 1.35,
              color: AppTheme.inkSoft,
            ),
          ),
        ],
      ),
    );
  }

  Widget _bar(DateTime day, String label) {
    final average = averages[day];
    final isSelected = day == selected;
    final fraction = average == null
        ? 0.0
        : (average / _tallest).clamp(0.06, 1.0);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => onSelect(day),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          if (average != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 3),
              child: Text(
                average.toStringAsFixed(0),
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: bandColour(average),
                ),
              ),
            ),
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
            width: 18,
            height: average == null ? 4 : _chartHeight * fraction,
            decoration: BoxDecoration(
              color: average == null
                  ? Colors.black.withValues(alpha: 0.08)
                  : bandColour(
                      average,
                    ).withValues(alpha: isSelected ? 1 : 0.55),
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              color: isSelected ? AppTheme.deep : AppTheme.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

/// How far through the curriculum a parent is: a ring and a plain sentence.
class LearningProgressCard extends StatelessWidget {
  final int read;
  final int total;

  const LearningProgressCard({
    super.key,
    required this.read,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final done = total > 0 && read >= total;
    final fraction = total == 0 ? 0.0 : (read / total).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 54,
            height: 54,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 54,
                  height: 54,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: fraction),
                    duration: const Duration(milliseconds: 700),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) => CircularProgressIndicator(
                      value: value,
                      strokeWidth: 6,
                      strokeCap: StrokeCap.round,
                      backgroundColor: AppTheme.lightest,
                      color: done ? const Color(0xFF2E7D32) : AppTheme.primary,
                    ),
                  ),
                ),
                Text(
                  '${(fraction * 100).round()}%',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.deep,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  S.learningProgress(read, total),
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.deep,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  done ? S.allTopicsRead : S.keepGoing,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    color: AppTheme.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A doorway with something live on it — what is there, not just where it goes.
class HomeTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String line;
  final bool highlight;
  final VoidCallback onTap;

  /// Tints the icon and its badge; the app's blue when not given.
  final Color? accent;

  /// A count shown on the icon's corner (unread answers) — nothing when 0.
  final int badge;

  const HomeTile({
    super.key,
    required this.icon,
    required this.title,
    required this.line,
    required this.onTap,
    this.highlight = false,
    this.accent,
    this.badge = 0,
  });

  @override
  Widget build(BuildContext context) {
    final tint = accent ?? AppTheme.primary;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppTheme.deep.withValues(alpha: 0.07),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: Container(
            constraints: const BoxConstraints(minHeight: 112),
            padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: highlight
                    ? tint.withValues(alpha: 0.5)
                    : Colors.black.withValues(alpha: 0.04),
                width: highlight ? 1.4 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The icon, with the unread count sitting on its corner.
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(15),
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                tint.withValues(alpha: 0.10),
                                tint.withValues(alpha: 0.24),
                              ],
                            ),
                          ),
                          child: Icon(icon, size: 23, color: tint),
                        ),
                        if (badge > 0)
                          Positioned(
                            top: -6,
                            right: -6,
                            child: Container(
                              constraints: const BoxConstraints(
                                minWidth: 20,
                                minHeight: 20,
                              ),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                              ),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: const Color(0xFFE53935),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: Colors.white,
                                  width: 2,
                                ),
                              ),
                              child: Text(
                                badge > 9 ? '9+' : '$badge',
                                style: const TextStyle(
                                  fontSize: 11,
                                  height: 1.1,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const Spacer(),
                    Icon(
                      Icons.arrow_outward_rounded,
                      size: 17,
                      color: AppTheme.inkSoft.withValues(alpha: 0.45),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  line,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.3,
                    color: highlight ? tint : AppTheme.inkSoft,
                    fontWeight: highlight ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Tiles laid out two to a row, each row as tall as its taller tile.
///
/// A `Row` with `crossAxisAlignment: stretch` cannot sit directly in a
/// scrolling list — the list gives it unbounded height and it throws "forces an
/// infinite height", which takes the whole screen down. [IntrinsicHeight] gives
/// the row the height of its tallest tile first, which is what makes stretching
/// safe. An odd last tile keeps its column rather than growing to full width.
class TileGrid extends StatelessWidget {
  final List<Widget> tiles;

  const TileGrid({super.key, required this.tiles});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < tiles.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 12),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: tiles[i]),
                const SizedBox(width: 12),
                Expanded(
                  child: i + 1 < tiles.length ? tiles[i + 1] : const SizedBox(),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

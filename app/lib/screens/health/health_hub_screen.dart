import 'dart:math';

import 'package:flutter/material.dart';

import '../../widgets/pin_gate.dart';

import '../../l10n/strings.dart';
import '../../models/glucose_reading.dart';
import '../../services/glucose_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import '../glucose/glucose_section_screen.dart';
import 'insulin_screen.dart';

/// The Health tab: a single glance at where things stand — the most recent
/// glucose reading, and when the next one is due — with one action, "Enter
/// my recent reading", that goes through the PIN gate into the combined
/// entry-and-calculators screen (see GlucoseEntryScreen). There is nothing
/// else here to navigate to: the Rule of 15 and IC/ISF calculators used to
/// be separate destinations reached from this hub, but both now live on
/// that same screen, fed directly from a reading instead of asking the
/// parent to type the number in twice.
class HealthHubScreen extends StatelessWidget {
  /// Where the PIN screen's Back goes when this is a tab.
  final VoidCallback? onBack;

  const HealthHubScreen({super.key, this.onBack});

  @override
  Widget build(BuildContext context) =>
      PinGate(onBack: onBack, child: const _HealthHubBody());
}

class _HealthHubBody extends StatefulWidget {
  const _HealthHubBody();

  @override
  State<_HealthHubBody> createState() => __HealthHubBodyState();
}

class __HealthHubBodyState extends State<_HealthHubBody> {
  // A field initializer, not `late` + initState: this screen is kept alive
  // inside HomeShell's IndexedStack, and a `late` field assigned in
  // initState has thrown LateInitializationError there before — assigning
  // here runs during construction, before build can ever see it unset.
  Future<_HealthSnapshot> _snapshot = _loadSnapshot();

  static Future<_HealthSnapshot> _loadSnapshot() async {
    try {
      final results = await Future.wait([
        GlucoseService.instance.status(),
        GlucoseService.instance.recent(limit: 1),
      ]);
      final readings = results[1] as List<GlucoseReading>;
      return _HealthSnapshot(
        available: true,
        status: results[0] as GlucoseEntryStatus,
        latest: readings.isEmpty ? null : readings.first,
      );
    } catch (_) {
      // Glucose entry is off for this study by default (ethics gate — see
      // GlucoseCooldownPanel's own note) or the request failed; either way
      // this reads as "nothing to show yet", not an error.
      return const _HealthSnapshot(
        available: false,
        status: null,
        latest: null,
      );
    }
  }

  Future<void> _refresh() async {
    final next = _loadSnapshot();
    setState(() => _snapshot = next);
    await next;
  }

  /// Waking hours only, and only once the last reading is a few hours old —
  /// a reminder to keep the record going, not a nag at night.
  static bool _isDueForReading(GlucoseReading? latest) {
    final now = DateTime.now();
    if (now.hour < 6 || now.hour >= 22) return false;
    if (latest == null) return true;
    return now.difference(latest.measuredAt) > const Duration(hours: 4);
  }

  Future<void> _openGlucose() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const GlucoseSectionScreen()));
    // A reading may have just been entered — refresh the dial to show it.
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppHeader(title: S.healthTools),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_HealthSnapshot>(
          future: _snapshot,
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final data = snapshot.data!;
            if (!data.available) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  const SizedBox(height: 60),
                  Icon(
                    Icons.water_drop_outlined,
                    size: 44,
                    color: AppTheme.deep.withValues(alpha: 0.3),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    S.glucoseDisabled,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13.5,
                      height: 1.45,
                      color: Colors.black.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              );
            }

            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
              children: [
                Center(child: _GlucoseDial(reading: data.latest)),
                if (_isDueForReading(data.latest)) ...[
                  const SizedBox(height: 18),
                  _RecordNudge(onTap: _openGlucose),
                ],
                const SizedBox(height: 18),
                Center(
                  child: Text(
                    data.latest == null
                        ? S.noReadingsYet
                        : _formatWhen(data.latest!.measuredAt),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.black.withValues(alpha: 0.55),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                Center(child: _NextReadingNote(status: data.status)),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _openGlucose,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.deep,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(S.enterRecentReading),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const InsulinScreen()),
                    ),
                    icon: const Icon(Icons.vaccines_outlined, size: 20),
                    label: Text(S.logInsulin),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.deep,
                      side: BorderSide(
                        color: AppTheme.deep.withValues(alpha: 0.25),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _HealthSnapshot {
  final bool available;
  final GlucoseEntryStatus? status;
  final GlucoseReading? latest;

  const _HealthSnapshot({
    required this.available,
    required this.status,
    required this.latest,
  });
}

/// The centre piece: the most recent reading inside a ring of dots, coloured
/// by band (low/in range/high) — a glance, not a chart.
class _GlucoseDial extends StatelessWidget {
  final GlucoseReading? reading;

  const _GlucoseDial({required this.reading});

  static const _bandColors = {
    GlucoseBand.low: Color(0xFFE53935),
    GlucoseBand.inRange: Color(0xFF2E7D32),
    GlucoseBand.high: Color(0xFFEF6C00),
  };

  @override
  Widget build(BuildContext context) {
    final r = reading;
    final color = r == null ? AppTheme.primary : _bandColors[r.band]!;

    return SizedBox(
      width: 216,
      height: 216,
      child: CustomPaint(
        painter: _DottedRingPainter(color: color),
        child: Center(
          child: Container(
            width: 148,
            height: 148,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: AppTheme.deep.withValues(alpha: 0.08),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  r == null ? '—' : r.value.toStringAsFixed(0),
                  style: TextStyle(
                    fontSize: 44,
                    fontWeight: FontWeight.w800,
                    color: color,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'mg/dL',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: color.withValues(alpha: 0.75),
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

/// A halo of dots around the reading, varying in size the way a hand-drawn
/// ring would rather than a perfectly uniform one.
class _DottedRingPainter extends CustomPainter {
  final Color color;

  const _DottedRingPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2;
    const dotCount = 48;

    for (var i = 0; i < dotCount; i++) {
      final angle = (2 * pi / dotCount) * i;
      final big = i % 4 == 0;
      final dotRadius = big ? 3.2 : 1.8;
      final alpha = big ? 0.55 : 0.25;
      final position =
          center + Offset(cos(angle), sin(angle)) * (radius - dotRadius);
      canvas.drawCircle(
        position,
        dotRadius,
        Paint()..color = color.withValues(alpha: alpha),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DottedRingPainter oldDelegate) =>
      oldDelegate.color != color;
}

/// "Next reading at…" from the cooldown status, or an "available now" note
/// — never silent about when the next entry is allowed.
class _NextReadingNote extends StatelessWidget {
  final GlucoseEntryStatus? status;

  const _NextReadingNote({required this.status});

  @override
  Widget build(BuildContext context) {
    final s = status;
    final text = (s == null || s.canEnterNow || s.nextAllowedAt == null)
        ? S.readingAvailableNow
        : S.nextReadingAt(_formatWhen(s.nextAllowedAt!));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.lightest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.schedule,
            size: 15,
            color: AppTheme.deep.withValues(alpha: 0.6),
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppTheme.deep.withValues(alpha: 0.75),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}';

String _formatWhen(DateTime when) {
  final now = DateTime.now();
  final sameDay =
      when.year == now.year && when.month == now.month && when.day == now.day;
  final time =
      '${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}';
  if (sameDay) return '${S.todayWord}, $time';
  return '${_formatDate(when)}, $time';
}

/// "Time to record a reading", shown when the last one is a few hours old.
class _RecordNudge extends StatelessWidget {
  final VoidCallback onTap;
  const _RecordNudge({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.primary.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              const Icon(Icons.edit_note_rounded, color: AppTheme.deep),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  S.timeToRecord,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.deep,
                  ),
                ),
              ),
              const Icon(Icons.chevron_right, color: AppTheme.deep),
            ],
          ),
        ),
      ),
    );
  }
}

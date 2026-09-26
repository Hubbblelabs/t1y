import 'dart:math';

import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/glucose_reading.dart';
import '../../providers/app_state.dart';
import '../../services/carb_service.dart';
import '../../services/glucose_service.dart';
import '../../services/health_access.dart';
import '../../services/insulin_service.dart';
import '../../services/local_reminders.dart';
import '../../theme/app_theme.dart';
import '../../utils/relative_time.dart';
import '../../widgets/app_header.dart';
import 'record_screen.dart';

/// The Health tab: a glance, then one way in.
///
/// Today's average glucose in the circle, how long since the last reading, and
/// today's insulin and carbohydrate totals — then "Enter my recent reading",
/// which asks for the parent PIN before anything can be recorded. Each part
/// shows only when this child is enrolled for it and the study has it on.
class HealthHubScreen extends StatefulWidget {
  const HealthHubScreen({super.key});

  @override
  State<HealthHubScreen> createState() => _HealthHubScreenState();
}

class _HealthGlance {
  final HealthAccess access;
  final List<GlucoseReading> today;
  final DateTime? lastReadingAt;
  final double? insulinToday;
  final double? carbsToday;

  const _HealthGlance({
    required this.access,
    required this.today,
    required this.lastReadingAt,
    required this.insulinToday,
    required this.carbsToday,
  });

  double? get averageToday => today.isEmpty
      ? null
      : today.map((r) => r.value).reduce((a, b) => a + b) / today.length;
}

class _HealthHubScreenState extends State<HealthHubScreen> {
  // A field initializer, not `late` + initState: this screen lives inside
  // HomeShell's IndexedStack, and assigning here means build never sees it
  // unset.
  Future<_HealthGlance> _glance = _load();

  static Future<T?> _quiet<T>(Future<T> call) =>
      call.timeout(const Duration(seconds: 15)).then<T?>((v) => v).catchError(
        (Object _) => null,
      );

  static Future<_HealthGlance> _load() async {
    final access = await HealthAccess.load();
    final now = DateTime.now();

    final results = await Future.wait<Object?>([
      access.glucose
          ? _quiet(GlucoseService.instance.recent(limit: 100, onDate: now))
          : Future.value(null),
      access.glucose
          ? _quiet(GlucoseService.instance.recent(limit: 1))
          : Future.value(null),
      access.insulin
          ? _quiet(InsulinService.instance.recent(limit: 30))
          : Future.value(null),
      access.carbs
          ? _quiet(CarbService.instance.recent(limit: 30))
          : Future.value(null),
    ]);

    final today = (results[0] as List<GlucoseReading>?) ?? const [];
    final latest = results[1] as List<GlucoseReading>?;
    if (access.glucose && latest != null) {
      // Keeps the phone's own reminder in step with readings recorded on
      // another phone in the family.
      await LocalReminders.scheduleAfter(
        latest.isEmpty ? null : latest.first.measuredAt,
      );
    }
    final doses = results[2] as List<InsulinDose>?;
    final carbs = results[3] as List<CarbEntry>?;

    return _HealthGlance(
      access: access,
      today: today,
      lastReadingAt: (latest == null || latest.isEmpty)
          ? null
          : latest.first.measuredAt,
      insulinToday: doses == null ? null : InsulinService.totalOn(now, doses),
      carbsToday: carbs == null ? null : CarbService.totalOn(now, carbs),
    );
  }

  Future<void> _refresh() async {
    final next = _load();
    setState(() {
      _glance = next;
    });
    await next;
  }

  Future<void> _record(RecordKind kind) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => RecordScreen(initial: kind)));
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppHeader(title: S.healthTools),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_HealthGlance>(
          future: _glance,
          builder: (context, snapshot) {
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final data = snapshot.data!;
            final access = data.access;
            if (!access.anything) {
              return ListView(
                padding: const EdgeInsets.all(28),
                children: [
                  const SizedBox(height: 60),
                  Text(
                    S.glucoseDisabled,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14.5,
                      height: 1.45,
                      color: AppTheme.inkSoft,
                    ),
                  ),
                ],
              );
            }

            final locale = AppState.instance.locale;
            final average = data.averageToday;
            final last = data.lastReadingAt;
            final overdue =
                last == null ||
                DateTime.now().difference(last) > const Duration(hours: 6);

            return ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                if (access.glucose) ...[
                  Center(child: _AverageDial(average: average)),
                  const SizedBox(height: 16),
                  Center(
                    child: _SincePill(
                      text: last == null
                          ? S.noReadingEver
                          : S.lastReadingAgo(relativeTime(last, locale: locale)),
                      warn: overdue,
                    ),
                  ),
                  const SizedBox(height: 22),
                ],
                if (access.insulin || access.carbs) ...[
                  Row(
                    children: [
                      if (access.insulin)
                        Expanded(
                          child: _TodayTile(
                            icon: Icons.vaccines_outlined,
                            title: S.insulin,
                            value: S.unitsValue(_plain(data.insulinToday ?? 0)),
                            onTap: () => _record(RecordKind.insulin),
                          ),
                        ),
                      if (access.insulin && access.carbs)
                        const SizedBox(width: 12),
                      if (access.carbs)
                        Expanded(
                          child: _TodayTile(
                            icon: Icons.restaurant_outlined,
                            title: S.carbs,
                            value: S.gramsValue(_plain(data.carbsToday ?? 0)),
                            onTap: () => _record(RecordKind.carbs),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
                FilledButton.icon(
                  onPressed: () => _record(
                    access.glucose
                        ? RecordKind.glucose
                        : (access.insulin
                              ? RecordKind.insulin
                              : RecordKind.carbs),
                  ),
                  icon: const Icon(Icons.edit_note_rounded),
                  label: Text(S.enterRecentReading),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

String _plain(double v) =>
    v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);

/// Today's average glucose inside a ring of dots, coloured by band.
class _AverageDial extends StatelessWidget {
  final double? average;
  const _AverageDial({required this.average});

  static Color _colour(double v) {
    if (v < 70) return const Color(0xFFE53935);
    if (v > 180) return const Color(0xFFEF6C00);
    return const Color(0xFF2E7D32);
  }

  @override
  Widget build(BuildContext context) {
    final a = average;
    final color = a == null ? AppTheme.primary : _colour(a);

    return SizedBox(
      width: 230,
      height: 230,
      child: CustomPaint(
        painter: _DottedRingPainter(color: color),
        child: Center(
          child: Container(
            width: 164,
            height: 164,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: AppTheme.deep.withValues(alpha: 0.10),
                  blurRadius: 22,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            padding: const EdgeInsets.all(14),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  S.todaysAverage,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.inkSoft,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  a == null ? '—' : a.toStringAsFixed(0),
                  style: TextStyle(
                    fontSize: 46,
                    fontWeight: FontWeight.w800,
                    color: color,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  a == null ? S.noReadingsToday : 'mg/dL',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: a == null ? 11.5 : 13,
                    fontWeight: FontWeight.w600,
                    color: a == null ? AppTheme.inkSoft : color,
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
      final dotRadius = big ? 3.4 : 1.9;
      final position =
          center + Offset(cos(angle), sin(angle)) * (radius - dotRadius);
      canvas.drawCircle(
        position,
        dotRadius,
        Paint()..color = color.withValues(alpha: big ? 0.6 : 0.3),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DottedRingPainter oldDelegate) =>
      oldDelegate.color != color;
}

/// "Last reading 2 h ago" — amber once it has been six hours or more, the same
/// gap after which the study sends a reminder.
class _SincePill extends StatelessWidget {
  final String text;
  final bool warn;
  const _SincePill({required this.text, required this.warn});

  @override
  Widget build(BuildContext context) {
    final fg = warn ? const Color(0xFFB45309) : AppTheme.deep;
    final bg = warn ? const Color(0xFFFFF4E0) : Colors.white;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.history_rounded, size: 16, color: fg),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: fg,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TodayTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final VoidCallback onTap;

  const _TodayTile({
    required this.icon,
    required this.title,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.lightest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: AppTheme.primary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.inkSoft,
                      ),
                    ),
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

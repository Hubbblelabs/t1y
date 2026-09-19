import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../config/api_config.dart';
import '../../l10n/strings.dart';
import '../../models/badge.dart';
import '../../models/glucose_reading.dart';
import '../../models/topic.dart';
import '../../providers/app_state.dart';
import '../../services/content_service.dart';
import '../../services/glucose_service.dart';
import '../../services/profile_service.dart';
import '../../services/progress_service.dart';
import '../../services/reminder_service.dart';
import '../../services/rewards_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import '../../widgets/hex_badge.dart';
import '../../widgets/locale_aware.dart';
import '../glucose/glucose_section_screen.dart';
import '../helpbook/topic_detail_screen.dart';
import '../rewards/badges_screen.dart';

/// Today's dashboard: where the participant is in the curriculum, what to
/// read next, what's coming up, and how their badges stand — rather than a
/// static list of links or a rotating tip nobody asked for. Everything here
/// is derived from real progress, reminder and reward data, so it is
/// empty-but-honest for a new account rather than showing fabricated
/// activity, and every card here does something when tapped.
class HomeTab extends StatefulWidget {
  final void Function(int tabIndex) onNavigateToTab;

  const HomeTab({super.key, required this.onNavigateToTab});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> with LocaleAware<HomeTab> {
  List<Topic> _topics = [];
  Set<String> _read = {};
  List<Reminder> _reminders = [];
  String _name = '';
  String? _baseUrl;
  bool _loading = true;
  BadgeCollection _badges = BadgeCollection.empty;

  /// Most recently opened topic's slug (any topic — read or not), from
  /// `TopicProgress.lastOpenedAt`. Null for an account that hasn't opened
  /// anything yet, in which case the "continue reading" card falls back to
  /// [_nextTopic] instead of disappearing.
  String? _lastOpenedSlug;

  DateTime _selectedDay = DateTime.now();
  List<GlucoseReading>? _dayReadings;
  bool _glucoseAvailable = true;
  bool _loadingDay = false;

  @override
  void initState() {
    super.initState();
    _selectedDay = _dateOnly(DateTime.now());
    _load();
    _loadDay(_selectedDay);
  }

  @override
  void onLocaleChanged(String locale) => _load();

  static DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    final results = await Future.wait([
      ContentService.instance.getTopics(AppState.instance.locale),
      ProgressService.instance.readTopicSlugs(),
      ReminderService.instance.upcoming(),
      ProfileService.instance.me(),
      ApiConfig.getBaseUrl(),
      ProgressService.instance.fetchProgress(),
    ]);
    // Best-effort, separately: a rewards outage should never block the rest
    // of the dashboard from loading.
    final badges = await RewardsService.instance.collection().catchError(
      (_) => BadgeCollection.empty,
    );
    if (!mounted) return;

    final me = results[3] as Map<String, dynamic>?;
    final profile = me?['profile'] as Map<String, dynamic>?;
    final progress = results[5] as Map<String, dynamic>?;
    // Already ordered lastOpenedAt desc server-side — see
    // listProgressForUser in api/lib/services/progress.ts.
    final progressTopics = progress?['topics'] as List<dynamic>?;

    setState(() {
      _topics = results[0] as List<Topic>;
      _read = results[1] as Set<String>;
      _reminders = results[2] as List<Reminder>;
      _name = (profile?['name'] as String?)?.trim().isNotEmpty == true
          ? (profile!['name'] as String).split(' ').first
          : ((me?['name'] as String?)?.split(' ').first ?? '');
      _baseUrl = results[4] as String;
      _badges = badges;
      _lastOpenedSlug = (progressTopics != null && progressTopics.isNotEmpty)
          ? progressTopics.first['topicSlug'] as String?
          : null;
      _loading = false;
    });
  }

  Future<void> _loadDay(DateTime day) async {
    setState(() => _loadingDay = true);
    try {
      final readings = await GlucoseService.instance.recent(onDate: day);
      if (!mounted) return;
      setState(() {
        _dayReadings = readings;
        _glucoseAvailable = true;
        _loadingDay = false;
      });
    } catch (_) {
      // Glucose entry is off for this study by default (ethics gate — see
      // GlucoseCooldownPanel's own note) or the request failed; either way
      // the day card just stays hidden rather than showing an error for
      // something the family was never meant to see.
      if (!mounted) return;
      setState(() {
        _dayReadings = null;
        _glucoseAvailable = false;
        _loadingDay = false;
      });
    }
  }

  void _selectDay(DateTime day) {
    final normalised = _dateOnly(day);
    if (normalised == _selectedDay) return;
    setState(() => _selectedDay = normalised);
    _loadDay(normalised);
  }

  void _openBadges() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const BadgesScreen()));
  }

  void _openGlucose() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const GlucoseSectionScreen()));
  }

  /// First unread topic in curriculum order — "continue where you left off".
  Topic? get _nextTopic {
    for (final t in _topics) {
      if (!_read.contains(t.slug)) return t;
    }
    return null;
  }

  /// The topic the "continue reading" card actually shows: whichever the
  /// parent most recently opened, or — for an account that has never opened
  /// one — the next unread topic, so the card is never simply absent.
  Topic? get _featuredTopic {
    final slug = _lastOpenedSlug;
    if (slug != null) {
      for (final t in _topics) {
        if (t.slug == slug) return t;
      }
    }
    return _nextTopic;
  }

  @override
  Widget build(BuildContext context) {
    final total = _topics.length;
    final featured = _featuredTopic;
    final isContinuing = _lastOpenedSlug != null && featured != null;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppHeader(title: S.home, showBadges: true),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => Future.wait([_load(), _loadDay(_selectedDay)]),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                children: [
                  if (_name.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 18, left: 2),
                      child: Text(
                        S.greetingForHour(DateTime.now().hour, _name),
                        style: GoogleFonts.dancingScript(
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.deep,
                          height: 1.1,
                        ),
                      ),
                    ),
                  _WeekPillCalendar(
                    selected: _selectedDay,
                    onSelect: _selectDay,
                  ),
                  const SizedBox(height: 14),
                  if (_glucoseAvailable)
                    _DayReadingsCard(
                      day: _selectedDay,
                      readings: _dayReadings,
                      loading: _loadingDay,
                      onTap: _openGlucose,
                    ),
                  if (featured != null) ...[
                    const SizedBox(height: 20),
                    _ContinueReadingCard(
                      topic: featured,
                      baseUrl: _baseUrl,
                      badgeLabel: isContinuing
                          ? S.continueReadingBadge
                          : S.startLearning,
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => TopicDetailScreen(topic: featured),
                          ),
                        );
                        await _load();
                      },
                    ),
                  ] else if (total > 0) ...[
                    const SizedBox(height: 20),
                    _AllDoneBanner(),
                  ],
                  const SizedBox(height: 20),
                  _RankBadgeStrip(badges: _badges, onTap: _openBadges),
                  if (_reminders.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    _SectionLabel(S.reminders),
                    ..._reminders
                        .take(3)
                        .map((r) => _ReminderTile(reminder: r)),
                  ],
                ],
              ),
            ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
          color: AppTheme.deep.withValues(alpha: 0.7),
        ),
      ),
    );
  }
}

/// The week strip: seven days, Monday first, the selected one filled as a
/// pill. Always shows the calendar week containing today — there is no
/// paging, matching how small and single-purpose this is meant to feel.
class _WeekPillCalendar extends StatelessWidget {
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;

  const _WeekPillCalendar({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final monday = today.subtract(Duration(days: today.weekday - 1));
    final labels = AppState.instance.isTamil
        ? S.weekdaysShortTa
        : S.weekdaysShort;

    return Row(
      children: List.generate(7, (i) {
        final day = DateTime(monday.year, monday.month, monday.day + i);
        final isSelected =
            day.year == selected.year &&
            day.month == selected.month &&
            day.day == selected.day;
        final isToday =
            day.year == today.year &&
            day.month == today.month &&
            day.day == today.day;

        return Expanded(
          child: GestureDetector(
            onTap: () => onSelect(day),
            behavior: HitTestBehavior.opaque,
            child: Column(
              children: [
                Text(
                  labels[i],
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.black.withValues(alpha: 0.4),
                  ),
                ),
                const SizedBox(height: 8),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.deep : Colors.transparent,
                    shape: BoxShape.circle,
                    border: isToday && !isSelected
                        ? Border.all(color: AppTheme.deep, width: 1.3)
                        : null,
                  ),
                  child: Text(
                    '${day.day}',
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: isSelected
                          ? Colors.white
                          : Colors.black.withValues(alpha: 0.75),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}

/// Average glucose for whichever day is selected above — the "attach the
/// readings" card. Absent (not an error state) when glucose entry isn't
/// enabled for this study, or shows an honest "no readings" rather than a
/// fabricated number when the day has none.
class _DayReadingsCard extends StatelessWidget {
  final DateTime day;
  final List<GlucoseReading>? readings;
  final bool loading;
  final VoidCallback onTap;

  const _DayReadingsCard({
    required this.day,
    required this.readings,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final list = readings;
    final average = (list != null && list.isNotEmpty)
        ? list.map((r) => r.value).reduce((a, b) => a + b) / list.length
        : null;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.lightest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.water_drop_outlined,
                  size: 19,
                  color: AppTheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      S.averageGlucose,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.black.withValues(alpha: 0.45),
                      ),
                    ),
                    const SizedBox(height: 2),
                    if (loading)
                      const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      Text(
                        average != null
                            ? '${average.toStringAsFixed(0)} mg/dL'
                            : S.noReadingsThatDay,
                        style: TextStyle(
                          fontSize: average != null ? 18 : 13,
                          fontWeight: FontWeight.w700,
                          color: average != null
                              ? AppTheme.deep
                              : Colors.black.withValues(alpha: 0.4),
                        ),
                      ),
                  ],
                ),
              ),
              if (list != null && list.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.lightest,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${list.length}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.deep,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The "continue reading" hero — a topic's own artwork with a frosted glass
/// panel along the bottom holding the badge, title and a reading-time chip,
/// rather than a plain caption under a plain thumbnail.
class _ContinueReadingCard extends StatelessWidget {
  final Topic topic;
  final String? baseUrl;
  final String badgeLabel;
  final VoidCallback onTap;

  const _ContinueReadingCard({
    required this.topic,
    required this.baseUrl,
    required this.badgeLabel,
    required this.onTap,
  });

  String? get _imageUrl {
    final raw = topic.thumbnailUrl;
    if (raw == null) return null;
    final base = baseUrl;
    if (base == null || raw.startsWith('http')) return raw;
    return raw.startsWith('/content/') ? '$base$raw' : raw;
  }

  @override
  Widget build(BuildContext context) {
    final image = _imageUrl;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        child: AspectRatio(
          aspectRatio: 16 / 10,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (image != null)
                Image.network(
                  image,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const _TopicArtworkFallback(),
                )
              else
                const _TopicArtworkFallback(),
              // The fade: a plain gradient darkens the lower third so white
              // text stays legible over any photo, then the glass panel sits
              // on top of that for the badge and title specifically.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black38],
                    stops: [0.5, 1.0],
                  ),
                ),
              ),
              Align(
                alignment: Alignment.bottomCenter,
                child: ClipRRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.22),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            topic.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.35),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.menu_book_outlined,
                                  size: 12,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  badgeLabel,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopicArtworkFallback extends StatelessWidget {
  const _TopicArtworkFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.accent, AppTheme.deep],
        ),
      ),
      child: Center(
        child: Icon(Icons.menu_book_outlined, size: 40, color: Colors.white70),
      ),
    );
  }
}

class _AllDoneBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF2E7D32).withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          const Icon(Icons.emoji_events_outlined, color: Color(0xFF2E7D32)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              S.allTopicsDone,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2E7D32),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReminderTile extends StatelessWidget {
  final Reminder reminder;
  const _ReminderTile({required this.reminder});

  static const _icons = {
    'MEDICATION_REMINDER': Icons.vaccines_outlined,
    'GLUCOSE_REMINDER': Icons.monitor_heart_outlined,
    'APPOINTMENT_REMINDER': Icons.event_outlined,
    'EDUCATION_NUDGE': Icons.menu_book_outlined,
  };

  String get _when {
    final t = reminder.nextTriggerAt;
    if (t == null) return reminder.timeOfDay ?? '';
    final diff = t.difference(DateTime.now());
    if (diff.isNegative) return 'due now';
    if (diff.inHours < 1) return 'in ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'in ${diff.inHours} h';
    return 'in ${diff.inDays} d';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.55)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppTheme.lightest,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(
              _icons[reminder.type] ?? Icons.notifications_outlined,
              size: 19,
              color: AppTheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  reminder.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (reminder.timeOfDay != null)
                  Text(
                    reminder.timeOfDay!,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.black.withValues(alpha: 0.5),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.lightest,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _when,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppTheme.deep,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Standing + recent badges, tappable through to the full rewards screen —
/// replaces the static rotating tip that used to sit here. The tip was the
/// same piece of text for every family regardless of how they were actually
/// doing; this is the opposite, built entirely from that child's own quiz
/// results, and it does something when touched.
class _RankBadgeStrip extends StatelessWidget {
  final BadgeCollection badges;
  final VoidCallback onTap;

  const _RankBadgeStrip({required this.badges, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final rank = badges.rank;
    final recent = badges.badges.take(5).toList();

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppTheme.accent.withValues(alpha: 0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  HexBadge(
                    tier: recent.isEmpty ? null : recent.first.tier,
                    size: 40,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rank?.title ?? S.myBadges,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.deep,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          S.badgesEarnedCount(badges.totalBadges),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.black.withValues(alpha: 0.55),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    color: AppTheme.deep.withValues(alpha: 0.4),
                  ),
                ],
              ),
              if (recent.length > 1) ...[
                const SizedBox(height: 12),
                SizedBox(
                  height: 46,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: recent.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (context, i) =>
                        HexBadge(tier: recent[i].tier, size: 46),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

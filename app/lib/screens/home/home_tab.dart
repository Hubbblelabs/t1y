import 'dart:async';

import 'package:flutter/material.dart';
import '../../widgets/peek_refresh.dart';
import '../../widgets/progress_card.dart';
import '../gallery/gallery_screen.dart';
import '../health/guardian_share_screen.dart';
import '../health/sos_screen.dart';
import '../../utils/tamil_name.dart';

import '../../l10n/strings.dart';
import '../../models/glucose_reading.dart';
import '../../providers/app_state.dart';
import '../../services/diary_details.dart';
import '../../services/local_reminders.dart';
import '../../services/glucose_service.dart';
import '../../services/insulin_service.dart';
import '../../services/app_tour.dart';
import '../../services/health_access.dart';
import '../../services/support_service.dart';
import '../../services/profile_service.dart';
import '../../services/reminder_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import '../../widgets/app_loader.dart';
import '../../widgets/locale_aware.dart';
import '../../widgets/tour_step.dart';
import '../health/record_screen.dart';
import '../profile/profile_details_screen.dart';
import '../help/help_screen.dart';
import 'home_cards.dart';
import 'home_shell.dart';

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
  List<Reminder> _reminders = [];
  String _name = '';

  /// The latest `/api/users/me`, for the "complete your details" card.
  Map<String, dynamic>? _me;
  bool _loading = true;

  /// The full-screen spinner is for the first load only. Every later refresh
  /// (pull-to-refresh, language change, coming back from a topic) updates in
  /// place — swapping the list for a spinner rebuilt it and threw the scroll
  /// position back to the top.
  bool _hasLoaded = false;

  /// Average glucose per day for the current week, keyed by day. A day with no
  /// readings is absent, never zero.
  Map<DateTime, double> _weekAverages = const {};

  double? _insulinToday;
  int _unreadAnswers = 0;

  DateTime _selectedDay = DateTime.now();
  bool _glucoseAvailable = true;

  /// Bumped on every refresh so the progress graph reloads with the rest.
  int _progressTick = 0;

  /// Every day's average glucose, for the graph slide.
  List<DailyGlucose> _dailyDays = const [];

  /// The details notice was closed with its X today.
  bool _noticeDismissed = false;
  HealthAccess _access = HealthAccess.all;

  @override
  void initState() {
    super.initState();
    _selectedDay = _dateOnly(DateTime.now());
    _load();
    _loadExtras();
    DiaryDetails.noticeDismissedToday().then((closed) {
      if (mounted) setState(() => _noticeDismissed = closed);
    });
  }

  /// How many days the strip shows, today included.
  static const _stripDays = 7;

  /// The days the strip shows, oldest first, ending today. There are no future
  /// days: nothing can be selected or recorded for a date that has not
  /// happened.
  static List<DateTime> _weekDays() {
    final today = DateTime.now();
    return [
      for (var i = _stripDays - 1; i >= 0; i--)
        DateTime(today.year, today.month, today.day - i),
    ];
  }

  /// Everything below the fold: the week's glucose, today's insulin, how many
  /// quizzes there are, and whether the study team has answered a question.
  ///
  /// Each call is guarded on its own and none can hold up the rest of the
  /// screen — these are extras, and a failure just leaves a card looking as it
  /// would for a family with nothing yet.
  Future<void> _loadExtras() async {
    final week = _weekDays();

    final results = await Future.wait<Object?>([
      // Null (not empty) when the request fails — glucose entry is off for
      // this study by default (ethics gate) or the server could not be
      // reached; either way the glucose parts of Home simply stay hidden.
      _guard<List<GlucoseReading>?>(
        // The API caps a page at 100; asking for more is rejected outright.
        GlucoseService.instance.recent(limit: 100),
        null,
      ),
      _guard<List<InsulinDose>>(
        InsulinService.instance.recent(limit: 100),
        const <InsulinDose>[],
      ),
      _guard<int>(SupportService.instance.unreadAnswers(), 0),
      _guard<List<DailyGlucose>>(
        GlucoseService.instance.dailyAverages(),
        const <DailyGlucose>[],
      ),
    ]);
    if (!mounted) return;

    final allReadings = results[0] as List<GlucoseReading>?;
    final readings = (allReadings ?? const <GlucoseReading>[])
        .where((r) => !r.measuredAt.isBefore(week.first))
        .toList();
    final doses = results[1] as List<InsulinDose>;

    setState(() {
      _progressTick++;
      _glucoseAvailable = allReadings != null;
      _weekAverages = dailyAverages(readings);
      _insulinToday = InsulinService.totalOn(DateTime.now(), doses);
      _unreadAnswers = results[2] as int;
      _dailyDays = results[3] as List<DailyGlucose>;
    });
  }

  @override
  void onLocaleChanged(String locale) => _load();

  static DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  /// Runs [call], falling back to [fallback] if it fails or takes too long, so
  /// no single request can stop the rest of the screen from appearing.
  static Future<T> _guard<T>(Future<T> call, T fallback) => call
      .timeout(const Duration(seconds: 12))
      .catchError((Object _) => fallback);

  Future<void> _load() async {
    if (mounted && !_hasLoaded) setState(() => _loading = true);

    // Each call is guarded on its own: one that fails simply contributes its
    // empty value, and the screen shows what it did get.
    final results = await Future.wait<Object?>([
      _guard(ReminderService.instance.upcoming(), <Reminder>[]),
      _guard<Map<String, dynamic>?>(ProfileService.instance.me(), null),
    ]);
    final access = await HealthAccess.load();

    if (!mounted) return;

    final me = results[1] as Map<String, dynamic>?;
    // Keeps the daily reminder in step with whether the details are still due.
    unawaited(LocalReminders.syncDetailsReminder(due: DiaryDetails.due(me)));
    DiaryDetails.attention.value = DiaryDetails.due(me);
    final profile = me?['profile'] as Map<String, dynamic>?;

    setState(() {
      _reminders = results[0] as List<Reminder>;
      _name = (profile?['name'] as String?)?.trim().isNotEmpty == true
          ? (profile!['name'] as String).split(' ').first
          : ((me?['name'] as String?)?.split(' ').first ?? '');
      _access = access;
      _me = me;
      _loading = false;
      _hasLoaded = true;
    });
  }

  /// Tapping a point on the graph moves the calendar to that day when it is
  /// in the week the calendar shows.
  void _selectDayIfInWeek(DateTime day) {
    final d = _dateOnly(day);
    if (_weekDays().contains(d)) _selectDay(d);
  }

  void _selectDay(DateTime day) {
    final normalised = _dateOnly(day);
    if (normalised == _selectedDay) return;
    setState(() => _selectedDay = normalised);
  }

  Future<void> _openRecord(RecordKind kind) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => RecordScreen(initial: kind)));
    _loadExtras();
  }

  /// The doorways under "More for you": plain tiles — a big heading and one line — two to a row.
  /// An odd last tile (SOS, normally) takes the full width.
  List<Widget> _rows() {
    String units(double v) =>
        v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);

    final tiles = <Widget>[
      _FeatureTile(
        icon: Icons.quiz_rounded,
        colours: const [Color(0xFFE3F2FD), Color(0xFFBBDEFB)],
        title: S.quizzes,
        subtitle: S.testYourself,
        onTap: () => widget.onNavigateToTab(HomeShell.quizzesTabIndex),
      ),
      _FeatureTile(
        icon: Icons.support_agent_rounded,
        colours: const [Color(0xFFE8EAF6), Color(0xFFC5CAE9)],
        title: S.helpAndSupport,
        subtitle: _unreadAnswers > 0
            ? S.newAnswerFromTeam
            : S.questionsAndAnswers,
        // The unread count sits on the tile's corner, as on a messaging app.
        badge: _unreadAnswers,
        onTap: () async {
          await Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const HelpScreen()));
          _loadExtras();
        },
      ),
      // Insulin and carb recording sit behind the same switch as glucose (the
      // study's overall health-logging flag), and further behind this
      // child's own enrolment and the carbohydrate switch (see HealthAccess).
      if (_glucoseAvailable && _access.insulin)
        _FeatureTile(
          icon: Icons.vaccines_rounded,
          colours: const [Color(0xFFE0F2F1), Color(0xFFB2DFDB)],
          title: S.insulin,
          subtitle: (_insulinToday ?? 0) > 0
              ? S.todayTotal(units(_insulinToday!))
              : S.recordDose,
          onTap: () => _openRecord(RecordKind.insulin),
        ),
      // Carbs are entered on the record screen alongside insulin, so this slot
      // goes to something Home had no way into: handing the readings to a
      // teacher or relative while the parent is away.
      if (_glucoseAvailable && _access.anything)
        _FeatureTile(
          icon: Icons.group_add_rounded,
          colours: const [Color(0xFFFFF3E0), Color(0xFFFFE0B2)],
          title: S.shareShort,
          subtitle: S.shareShortLine,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const GuardianShareScreen()),
          ),
        ),
      _FeatureTile(
        icon: Icons.photo_library_rounded,
        colours: const [Color(0xFFF3E5F5), Color(0xFFE1BEE7)],
        title: S.gallery,
        subtitle: S.extraInformation,
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const GalleryScreen())),
      ),
      // Last, and in red, so it is never mistaken for another tile.
      TourStep(
        tourKey: AppTour.sos,
        title: S.tourSosTitle,
        description: S.tourSosBody,
        child: _FeatureTile(
          icon: Icons.sos_rounded,
          colours: const [Color(0xFFFFEBEE), Color(0xFFFFCDD2)],
          title: S.sosContacts,
          danger: true,
          subtitle: S.sosLine,
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const SosScreen())),
        ),
      ),
    ];

    return [
      for (var i = 0; i < tiles.length; i += 2) ...[
        if (i > 0) const SizedBox(height: 12),
        if (i + 1 < tiles.length)
          Row(
            children: [
              Expanded(child: tiles[i]),
              const SizedBox(width: 12),
              Expanded(child: tiles[i + 1]),
            ],
          )
        else
          tiles[i],
      ],
    ];
  }

  Future<void> _onRefresh() => Future.wait([_load(), _loadExtras()]);

  /// A small picture for the time of day, beside the greeting.
  static IconData _dayIcon(int hour) {
    if (hour >= 4 && hour < 12) return Icons.wb_sunny_rounded;
    if (hour >= 12 && hour < 17) return Icons.wb_cloudy_rounded;
    if (hour >= 17 && hour < 20) return Icons.wb_twilight_rounded;
    return Icons.nights_stay_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final glucoseOn = _glucoseAvailable && _access.glucose;

    Widget padded(Widget child) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: child,
    );

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppHeader(title: S.home, showBadges: true, tour: true),
      body: _loading
          ? const Center(child: AppLoader())
          : PeekRefresh(
              onRefresh: _onRefresh,
              child: ListView(
                // Bouncing on every platform, so the pull can reveal the
                // character on Android as well.
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.only(bottom: 32),
                children: [
                  // The top of the page: greeting and the day strip on a soft
                  // blue wash, so the screen has a clear starting point.
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 6, 20, 16),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFFE3F2FD), Color(0xFFF4F9FE)],
                      ),
                      borderRadius: BorderRadius.vertical(
                        bottom: Radius.circular(28),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_name.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: TourStep(
                              tourKey: AppTour.home,
                              title: S.tourHomeTitle,
                              description: S.tourHomeBody,
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      S.greetingForHour(hour, localName(_name)),
                                      style: const TextStyle(
                                        fontSize: 24,
                                        height: 1.2,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.deep,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Container(
                                    width: 46,
                                    height: 46,
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppTheme.deep.withValues(
                                            alpha: 0.10,
                                          ),
                                          blurRadius: 12,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Icon(
                                      _dayIcon(hour),
                                      color: const Color(0xFFFFA000),
                                      size: 26,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        if (DiaryDetails.due(_me) && !_noticeDismissed) ...[
                          _DetailsDueCard(
                            onDismiss: () async {
                              setState(() => _noticeDismissed = true);
                              await DiaryDetails.dismissNoticeToday();
                            },
                            missing: DiaryDetails.missing(_me).length,
                            onTap: () async {
                              final me = _me;
                              if (me == null) return;
                              await Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => ProfileDetailsScreen(
                                    me: me,
                                    startEditing: true,
                                  ),
                                ),
                              );
                              _load();
                            },
                          ),
                          const SizedBox(height: 14),
                        ],
                        TourStep(
                          tourKey: AppTour.readings,
                          title: S.tourReadingsTitle,
                          description: S.tourReadingsBody,
                          child: Column(
                            children: [
                              _WeekPillCalendar(
                                days: _weekDays(),
                                selected: _selectedDay,
                                onSelect: _selectDay,
                                averages: _weekAverages,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  // The glucose graph: how the average has moved since the first
                  // reading. Picking a day above shows that day on it.
                  if (glucoseOn)
                    padded(
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: GlucoseGraph.isReady(_dailyDays)
                            ? GlucoseGraph(
                                key: ValueKey(_progressTick),
                                days: _dailyDays,
                                focusDay: _selectedDay,
                                onDayTapped: _selectDayIfInWeek,
                              )
                            : const GlucoseGraphWaiting(),
                      ),
                    ),
                  padded(
                    Padding(
                      padding: const EdgeInsets.only(top: 26),
                      child: _SectionLabel(S.moreForYou),
                    ),
                  ),
                  padded(Column(children: _rows())),
                  if (_reminders.isNotEmpty) ...[
                    padded(
                      Padding(
                        padding: const EdgeInsets.only(top: 26),
                        child: _SectionLabel(S.reminders),
                      ),
                    ),
                    padded(
                      _RowGroup(
                        children: [
                          for (final r in _reminders.take(3))
                            _ReminderRow(reminder: r),
                        ],
                      ),
                    ),
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
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 15.5,
          fontWeight: FontWeight.w700,
          color: AppTheme.ink,
        ),
      ),
    );
  }
}

/// The day strip: the last seven days with today at the end, the selected one
/// filled as a pill. Future dates are never shown, so they cannot be tapped.
class _WeekPillCalendar extends StatelessWidget {
  final List<DateTime> days;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;

  /// Each day's average glucose, shown as a small number under its date — green
  /// inside the usual range, amber outside it. A day without readings is absent.
  final Map<DateTime, double> averages;

  const _WeekPillCalendar({
    required this.days,
    required this.selected,
    required this.onSelect,
    this.averages = const {},
  });

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final labels = AppState.instance.isTamil
        ? S.weekdaysShortTa
        : S.weekdaysShort;

    return Row(
      children: List.generate(days.length, (i) {
        final day = days[i];
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
                  labels[day.weekday - 1],
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.inkSoft,
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
                const SizedBox(height: 6),
                // Always occupies its space, so the strip does not change
                // height as readings come in.
                SizedBox(
                  height: 15,
                  child: averages[day] == null
                      ? null
                      : Text(
                          averages[day]!.round().toString(),
                          style: TextStyle(
                            fontSize: 11.5,
                            height: 1.3,
                            fontWeight: FontWeight.w800,
                            color: (averages[day]! < 70 || averages[day]! > 180)
                                ? const Color(0xFFEF6C00)
                                : const Color(0xFF2E7D32),
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

/// Asks the family to complete the patient-diary details. Shown from a few
/// days after sign-up until nothing required is blank.
class _DetailsDueCard extends StatelessWidget {
  final int missing;
  final VoidCallback onTap;

  /// Closes the notice for today (it returns tomorrow while details are missing).
  final VoidCallback onDismiss;
  const _DetailsDueCard({
    required this.missing,
    required this.onTap,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFFF4E5),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFFFB74D)),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFB74D).withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.assignment_ind_outlined,
                  color: Color(0xFFEF6C00),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      S.detailsDueTitle,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      S.detailsDueBody(missing),
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppTheme.inkSoft,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF6C00),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  S.detailsDueButton,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 2),
              // Closes the notice for today.
              InkResponse(
                onTap: onDismiss,
                radius: 18,
                child: const Padding(
                  padding: EdgeInsets.all(6),
                  child: Icon(
                    Icons.close_rounded,
                    size: 20,
                    color: AppTheme.inkSoft,
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

const _hairline = Color(0xFFE6EAF0);

/// One quiet container holding several rows, divided by hairlines — instead of
/// a separate card for each.
class _RowGroup extends StatelessWidget {
  final List<Widget> children;
  const _RowGroup({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFD),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _hairline),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0)
                const Divider(
                  height: 1,
                  thickness: 1,
                  indent: 62,
                  color: _hairline,
                ),
              children[i],
            ],
          ],
        ),
      ),
    );
  }
}

/// An upcoming reminder, as a row in the same grouped list.
class _ReminderRow extends StatelessWidget {
  final Reminder reminder;
  const _ReminderRow({required this.reminder});

  String get _when {
    final t = reminder.nextTriggerAt;
    if (t == null) return reminder.timeOfDay ?? '';
    final diff = t.difference(DateTime.now());
    if (diff.isNegative) return S.dueNow;
    if (diff.inHours < 1) return S.inMinutes(diff.inMinutes);
    if (diff.inHours < 24) return S.inHours(diff.inHours);
    return S.inDays(diff.inDays);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              reminder.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: AppTheme.ink,
              ),
            ),
          ),
          Text(
            _when,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: AppTheme.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

/// A soft pastel tile: a heading and one line beneath, with the section's icon
/// as a large, faint picture in the corner (no small icon above the title).
///
/// Every tile is exactly the same height, whatever its words, so a long title
/// ("Help and support") can never make its neighbour a different size. The
/// text shrinks to fit rather than the tile growing. An optional unread count
/// sits on the corner, and [danger] colours the heading red (SOS).
class _FeatureTile extends StatelessWidget {
  static const height = 112.0;

  final String title;
  final String subtitle;
  final IconData icon;
  final List<Color> colours;
  final int badge;
  final bool danger;
  final VoidCallback onTap;

  const _FeatureTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.colours,
    required this.onTap,
    this.badge = 0,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    final headingColour = danger ? const Color(0xFFB71C1C) : AppTheme.deep;

    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colours,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            children: [
              // The faint picture behind the words.
              Positioned(
                right: -12,
                bottom: -16,
                child: Icon(
                  icon,
                  size: 86,
                  color: headingColour.withValues(alpha: 0.10),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          // One line that scales down, so the tile never grows.
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text(
                              title,
                              maxLines: 1,
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: headingColour,
                              ),
                            ),
                          ),
                        ),
                        if (badge > 0)
                          Container(
                            margin: const EdgeInsets.only(left: 8),
                            constraints: const BoxConstraints(
                              minWidth: 22,
                              minHeight: 22,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            alignment: Alignment.center,
                            decoration: const BoxDecoration(
                              color: Color(0xFFE53935),
                              borderRadius: BorderRadius.all(
                                Radius.circular(11),
                              ),
                            ),
                            child: Text(
                              badge > 9 ? '9+' : '$badge',
                              style: const TextStyle(
                                fontSize: 12,
                                height: 1.1,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Expanded(
                      child: Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.3,
                          color: headingColour.withValues(alpha: 0.72),
                        ),
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

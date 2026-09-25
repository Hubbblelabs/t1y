import 'package:flutter/material.dart';

import '../../config/api_config.dart';
import '../../l10n/strings.dart';
import '../../models/topic.dart';
import '../../providers/app_state.dart';
import '../../services/content_service.dart';
import '../../services/profile_service.dart';
import '../../services/progress_service.dart';
import '../../services/reminder_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import '../../widgets/locale_aware.dart';
import '../../widgets/topic_card.dart';
import '../helpbook/topic_detail_screen.dart';
import 'home_shell.dart';

/// Today's dashboard: where the participant is in the curriculum, what to
/// read next, what's coming up, and a tip — rather than a static list of
/// links. Everything here is derived from real progress and reminder data,
/// so it is empty-but-honest for a new account rather than showing
/// fabricated activity.
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
  /// Bumped on every pull-to-refresh so the tip visibly changes.
  int _tipKey = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void onLocaleChanged(String locale) => _load();

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    final results = await Future.wait([
      ContentService.instance.getTopics(AppState.instance.locale),
      ProgressService.instance.readTopicSlugs(),
      ReminderService.instance.upcoming(),
      ProfileService.instance.me(),
      ApiConfig.getBaseUrl(),
    ]);
    if (!mounted) return;

    final me = results[3] as Map<String, dynamic>?;
    final profile = me?['profile'] as Map<String, dynamic>?;

    setState(() {
      _topics = results[0] as List<Topic>;
      _read = results[1] as Set<String>;
      _reminders = results[2] as List<Reminder>;
      _name = (profile?['firstName'] as String?)?.trim().isNotEmpty == true
          ? profile!['firstName'] as String
          : ((me?['name'] as String?)?.split(' ').first ?? '');
      _baseUrl = results[4] as String;
      _loading = false;
    });
  }

  /// First unread topic in curriculum order — "continue where you left off".
  Topic? get _nextTopic {
    for (final t in _topics) {
      if (!_read.contains(t.slug)) return t;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final next = _nextTopic;
    final total = _topics.length;
    final done = _topics.where((t) => _read.contains(t.slug)).length;

    return Scaffold(
      appBar: AppHeader(title: S.home),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                setState(() => _tipKey++);
                await _load();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                children: [
                  if (_name.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14, left: 4),
                      child: Text(
                        S.greeting(_name),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.deep,
                        ),
                      ),
                    ),
                  // Tip sits at the top: it fills the gap beside the greeting
                  // and is the first thing a parent sees after pulling to
                  // refresh, which is when a fresh tip is most noticeable.
                  _TipCard(refreshKey: _tipKey),
                  const SizedBox(height: 16),
                  _ProgressRing(done: done, total: total),
                  const SizedBox(height: 18),
                  if (next != null) ...[
                    _SectionLabel(
                      done == 0 ? S.startLearning : S.continueReading,
                    ),
                    TopicCard(
                      topic: next,
                      baseUrl: _baseUrl,
                      isRead: false,
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => TopicDetailScreen(topic: next),
                          ),
                        );
                        await _load();
                      },
                    ),
                  ] else if (total > 0) ...[
                    _AllDoneBanner(),
                    const SizedBox(height: 18),
                  ],
                  if (_reminders.isNotEmpty) ...[
                    _SectionLabel(S.reminders),
                    ..._reminders.take(3).map((r) => _ReminderTile(reminder: r)),
                    const SizedBox(height: 18),
                  ],
                  _SectionLabel(S.quickActions),
                  _QuickActions(onNavigateToTab: widget.onNavigateToTab),
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

/// Animated completion ring — the dashboard's headline number.
class _ProgressRing extends StatefulWidget {
  final int done;
  final int total;

  const _ProgressRing({required this.done, required this.total});

  @override
  State<_ProgressRing> createState() => _ProgressRingState();
}

class _ProgressRingState extends State<_ProgressRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fraction = widget.total == 0 ? 0.0 : widget.done / widget.total;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.primary, AppTheme.deep],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              final t = Curves.easeOutCubic.transform(_controller.value);
              return SizedBox(
                width: 78,
                height: 78,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 78,
                      height: 78,
                      child: CircularProgressIndicator(
                        value: fraction * t,
                        strokeWidth: 7,
                        backgroundColor: Colors.white.withValues(alpha: 0.22),
                        valueColor: const AlwaysStoppedAnimation(Colors.white),
                      ),
                    ),
                    Text(
                      '${(fraction * t * 100).round()}%',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  S.yourProgress,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  S.topicsRead(widget.done, widget.total),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
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
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
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

class _QuickActions extends StatelessWidget {
  final void Function(int) onNavigateToTab;
  const _QuickActions({required this.onNavigateToTab});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Icons.menu_book_outlined,
            label: S.helpBook,
            onTap: () => onNavigateToTab(HomeShell.helpBookTabIndex),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionTile(
            icon: Icons.calculate_outlined,
            label: S.calculations,
            onTap: () => onNavigateToTab(HomeShell.calculationsTabIndex),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ActionTile(
            icon: Icons.quiz_outlined,
            label: S.quizzes,
            onTap: () => onNavigateToTab(HomeShell.quizzesTabIndex),
          ),
        ),
      ],
    );
  }
}

/// Tile that dips slightly on press — the "little movement" the flat icons
/// were missing.
class _ActionTile extends StatefulWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionTile({required this.icon, required this.label, required this.onTap});

  @override
  State<_ActionTile> createState() => _ActionTileState();
}

class _ActionTileState extends State<_ActionTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.93 : 1,
        duration: const Duration(milliseconds: 130),
        curve: Curves.easeOut,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: AppTheme.deep.withValues(alpha: _pressed ? 0.04 : 0.08),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              Icon(widget.icon, size: 26, color: AppTheme.primary),
              const SizedBox(height: 8),
              Text(
                widget.label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.deep,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Rotating tip drawn from the study curriculum, in the active language.
class _TipCard extends StatelessWidget {
  final int refreshKey;
  const _TipCard({required this.refreshKey});

  static const _tipsEn = [
    'Check blood glucose before sports. Above 250, take a correction dose first; below 100, eat 15–30 g of carbs.',
    'The Rule of 15: below 70 mg/dL, take 15 g of fast-acting carbs and recheck after 15 minutes.',
    'Rotate injection sites — using the same spot every time can cause lumps under the skin.',
    'Keep insulin cool while travelling with a Frio pouch or ice pack. Never freeze it.',
    'Carry a diabag everywhere: insulin, glucose tablets and a spare glucometer.',
    'HbA1c should be checked 3–4 times a year; it reflects your average glucose over 2–3 months.',
  ];

  static const _tipsTa = [
    'விளையாட்டுக்கு முன் இரத்த சர்க்கரையைச் சரிபார்க்கவும். 250-க்கு மேல் இருந்தால் திருத்தும் அளவு எடுக்கவும்; 100-க்குக் கீழ் இருந்தால் 15–30 கிராம் கார்ப் உண்ணவும்.',
    '15 விதி: 70 mg/dL-க்குக் கீழ் இருந்தால், 15 கிராம் விரைவு கார்ப் எடுத்து 15 நிமிடம் கழித்து மீண்டும் சரிபார்க்கவும்.',
    'ஊசி போடும் இடத்தை மாற்றி மாற்றிப் பயன்படுத்துங்கள் — ஒரே இடத்தில் போட்டால் தோலுக்கு அடியில் கட்டிகள் வரலாம்.',
    'பயணத்தின்போது இன்சுலினை Frio பை அல்லது ஐஸ் பேக்கில் குளிராக வைக்கவும். ஒருபோதும் உறைய வைக்க வேண்டாம்.',
    'எப்போதும் டயாபேக் எடுத்துச் செல்லுங்கள்: இன்சுலின், குளுக்கோஸ் மாத்திரைகள், கூடுதல் குளுக்கோமீட்டர்.',
    'HbA1c ஆண்டுக்கு 3–4 முறை பரிசோதிக்க வேண்டும்; இது 2–3 மாத சராசரி சர்க்கரை அளவைக் காட்டுகிறது.',
  ];

  @override
  Widget build(BuildContext context) {
    final tips = AppState.instance.isTamil ? _tipsTa : _tipsEn;
    // Advances on each manual refresh; otherwise stable for the day rather
    // than shuffling on every rebuild.
    final tip = tips[(DateTime.now().day + refreshKey) % tips.length];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.accent.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: const BoxDecoration(
                  color: AppTheme.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.lightbulb_outline,
                  size: 17,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                S.tipOfTheDay,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.deep,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            tip,
            style: TextStyle(
              fontSize: 13.5,
              height: 1.5,
              color: Colors.black.withValues(alpha: 0.75),
            ),
          ),
        ],
      ),
    );
  }
}

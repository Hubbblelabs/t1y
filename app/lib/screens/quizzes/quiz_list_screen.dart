import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/badge.dart';
import '../../models/quiz.dart';
import '../../providers/app_state.dart';
import '../../services/quiz_service.dart';
import '../../services/rewards_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import '../../widgets/hex_badge.dart';
import '../../widgets/locale_aware.dart';
import 'quiz_take_screen.dart';

/// Quizzes plus, per quiz, the badge already earned for it (if any) — loaded
/// together so the list has one loading/error state rather than the badges
/// popping in a beat after the quiz titles do.
class _QuizListData {
  final List<Quiz> quizzes;
  final Map<String, QuizBadge> badgeByQuizId;

  const _QuizListData({required this.quizzes, required this.badgeByQuizId});
}

class QuizListScreen extends StatefulWidget {
  const QuizListScreen({super.key});

  @override
  State<QuizListScreen> createState() => _QuizListScreenState();
}

class _QuizListScreenState extends State<QuizListScreen>
    with LocaleAware<QuizListScreen> {
  late Future<_QuizListData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load(loadedLocale);
  }

  /// Badges are read best-effort: a child should see the quiz list even if
  /// the rewards call fails (offline, say) — every tile just falls back to
  /// the empty/unearned badge in that case rather than the whole list
  /// failing to load.
  Future<_QuizListData> _load(String locale) async {
    final quizzes = await QuizService.instance.getQuizzes(locale);
    final badges = await RewardsService.instance.collection().catchError(
      (_) => BadgeCollection.empty,
    );
    return _QuizListData(
      quizzes: quizzes,
      badgeByQuizId: {for (final b in badges.badges) b.quizId: b},
    );
  }

  @override
  void onLocaleChanged(String locale) {
    setState(() => _future = _load(locale));
  }

  Future<void> _refresh() async {
    setState(() => _future = _load(AppState.instance.locale));
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(title: S.quizzes, showBadges: true),
      body: FutureBuilder<_QuizListData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${S.couldNotLoad}\n${snapshot.error}',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _refresh,
                      child: Text(S.tryAgain),
                    ),
                  ],
                ),
              ),
            );
          }

          final quizzes = snapshot.data?.quizzes ?? [];
          final badgeByQuizId = snapshot.data?.badgeByQuizId ?? const {};
          if (quizzes.isEmpty) {
            return Center(child: Text(S.noQuizzesYet));
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: quizzes.length,
            separatorBuilder: (_, index) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final quiz = quizzes[index];
              final badge = badgeByQuizId[quiz.id];
              return Card(
                child: ListTile(
                  // The quiz's own earned badge (or the unearned/fallback
                  // hamster when there isn't one yet) — a glance at the
                  // list already shows what's been conquered.
                  leading: HexBadge(tier: badge?.tier, size: 44),
                  title: Text(quiz.title),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Text(
                      //   quiz.description ?? '${quiz.questions.length} questions',
                      // ),
                      // The study's quizzes are English-only for now, so a
                      // Tamil participant sees them flagged rather than
                      // silently missing (see listPublishedQuizBundle).
                      if (quiz.isFallback)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.translate,
                                size: 12,
                                color: Color(0xFFB26A00),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                S.englishOnly,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFB26A00),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  isThreeLine: quiz.isFallback,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => QuizTakeScreen(quiz: quiz),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

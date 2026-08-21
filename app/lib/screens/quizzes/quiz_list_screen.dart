import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/quiz.dart';
import '../../providers/app_state.dart';
import '../../services/quiz_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import '../../widgets/locale_aware.dart';
import 'quiz_take_screen.dart';

class QuizListScreen extends StatefulWidget {
  const QuizListScreen({super.key});

  @override
  State<QuizListScreen> createState() => _QuizListScreenState();
}

class _QuizListScreenState extends State<QuizListScreen>
    with LocaleAware<QuizListScreen> {
  late Future<List<Quiz>> _future;

  @override
  void initState() {
    super.initState();
    _future = QuizService.instance.getQuizzes(loadedLocale);
  }

  @override
  void onLocaleChanged(String locale) {
    setState(() => _future = QuizService.instance.getQuizzes(locale));
  }

  Future<void> _refresh() async {
    setState(() {
      _future = QuizService.instance.getQuizzes(AppState.instance.locale);
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(title: S.quizzes),
      body: FutureBuilder<List<Quiz>>(
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
                    OutlinedButton(onPressed: _refresh, child: Text(S.tryAgain)),
                  ],
                ),
              ),
            );
          }

          final quizzes = snapshot.data ?? [];
          if (quizzes.isEmpty) {
            return Center(child: Text(S.noQuizzesYet));
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: quizzes.length,
            separatorBuilder: (_, index) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final quiz = quizzes[index];
              return Card(
                child: ListTile(
                  leading: CircleAvatar(child: Text('${quiz.questions.length}')),
                  title: Text(quiz.title),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(quiz.description ?? '${quiz.questions.length} questions'),
                      // The study's quizzes are English-only for now, so a
                      // Tamil participant sees them flagged rather than
                      // silently missing (see listPublishedQuizBundle).
                      if (quiz.isFallback)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.translate,
                                  size: 12, color: Color(0xFFB26A00)),
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
                  trailing: const Icon(Icons.chevron_right, color: AppTheme.primary),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => QuizTakeScreen(quiz: quiz)),
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

import 'package:flutter/material.dart';

import '../../models/quiz.dart';
import '../../providers/app_state.dart';
import '../../services/quiz_service.dart';
import '../../widgets/app_header.dart';
import 'quiz_take_screen.dart';

class QuizListScreen extends StatefulWidget {
  const QuizListScreen({super.key});

  @override
  State<QuizListScreen> createState() => _QuizListScreenState();
}

class _QuizListScreenState extends State<QuizListScreen> {
  late Future<List<Quiz>> _future;

  @override
  void initState() {
    super.initState();
    _future = QuizService.instance.getQuizzes(AppState.instance.locale);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppHeader(title: 'Quizzes'),
      body: FutureBuilder<List<Quiz>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Could not load quizzes.\n${snapshot.error}', textAlign: TextAlign.center));
          }

          final quizzes = snapshot.data ?? [];
          if (quizzes.isEmpty) {
            return const Center(child: Text('No quizzes published yet.'));
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
                  subtitle: Text(quiz.description ?? '${quiz.questions.length} questions'),
                  trailing: const Icon(Icons.chevron_right),
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

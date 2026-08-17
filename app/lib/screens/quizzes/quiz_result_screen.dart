import 'package:flutter/material.dart';

import '../../models/quiz.dart';
import '../../services/quiz_service.dart';

class QuizResultScreen extends StatelessWidget {
  final Quiz quiz;
  final QuizAttemptResult result;

  const QuizResultScreen({super.key, required this.quiz, required this.result});

  @override
  Widget build(BuildContext context) {
    final passed = result.passed;
    return Scaffold(
      appBar: AppBar(title: const Text('Quiz complete')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                passed == true ? Icons.check_circle : Icons.info_outline,
                size: 64,
                color: passed == true
                    ? Colors.green
                    : Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 16),
              Text('${result.scorePercent}%', style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: 8),
              if (passed != null)
                Text(passed ? 'Passed' : 'Not yet — try reviewing the topic again.'),
              const SizedBox(height: 32),
              FilledButton(
                onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                child: const Text('Done'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

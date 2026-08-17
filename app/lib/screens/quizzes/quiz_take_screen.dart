import 'package:flutter/material.dart';

import '../../models/quiz.dart';
import '../../services/api_client.dart';
import '../../services/quiz_service.dart';
import 'quiz_result_screen.dart';

class QuizTakeScreen extends StatefulWidget {
  final Quiz quiz;
  const QuizTakeScreen({super.key, required this.quiz});

  @override
  State<QuizTakeScreen> createState() => _QuizTakeScreenState();
}

class _QuizTakeScreenState extends State<QuizTakeScreen> {
  late final DateTime _startedAt;
  int _index = 0;
  final Map<String, dynamic> _answers = {}; // questionKey -> answer map
  bool _submitting = false;

  // Per-question transient UI state.
  String? _selectedOptionId;
  final List<String> _orderingSelection = [];
  final Map<String, String> _matchingSelection = {}; // leftOptionId -> matchOptionId

  @override
  void initState() {
    super.initState();
    _startedAt = DateTime.now();
  }

  QuizQuestion get _question => widget.quiz.questions[_index];
  bool get _isLast => _index == widget.quiz.questions.length - 1;

  bool get _canAdvance {
    switch (_question.type) {
      case QuestionType.singleChoice:
      case QuestionType.trueFalse:
        return _selectedOptionId != null;
      case QuestionType.ordering:
        return _orderingSelection.length == _question.options.length;
      case QuestionType.matching:
        return _matchingSelection.length == _question.options.length;
    }
  }

  void _recordAnswer() {
    switch (_question.type) {
      case QuestionType.singleChoice:
      case QuestionType.trueFalse:
        _answers[_question.questionKey] = {'optionId': _selectedOptionId};
        break;
      case QuestionType.ordering:
        _answers[_question.questionKey] = {'order': List<String>.from(_orderingSelection)};
        break;
      case QuestionType.matching:
        _answers[_question.questionKey] = {
          'pairs': _matchingSelection.entries
              .map((e) => {'optionId': e.key, 'matchOptionId': e.value})
              .toList(),
        };
        break;
    }
  }

  void _resetTransientState() {
    _selectedOptionId = null;
    _orderingSelection.clear();
    _matchingSelection.clear();
  }

  Future<void> _next() async {
    _recordAnswer();

    if (!_isLast) {
      setState(() {
        _index++;
        _resetTransientState();
      });
      return;
    }

    setState(() => _submitting = true);
    try {
      final responses = _answers.entries
          .map((e) => {
                'questionKey': e.key,
                'answer': e.value,
                'answeredAt': DateTime.now().toUtc().toIso8601String(),
              })
          .toList();

      final result = await QuizService.instance.submitAttempt(
        quiz: widget.quiz,
        startedAt: _startedAt,
        responses: responses,
      );

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => QuizResultScreen(quiz: widget.quiz, result: result)),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final question = _question;
    return Scaffold(
      appBar: AppBar(title: Text('Question ${_index + 1} / ${widget.quiz.questions.length}')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LinearProgressIndicator(value: (_index + 1) / widget.quiz.questions.length),
            const SizedBox(height: 16),
            Text(question.prompt, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 16),
            Expanded(child: _buildQuestionBody(question)),
            FilledButton(
              onPressed: (_canAdvance && !_submitting) ? _next : null,
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(_isLast ? 'Submit' : 'Next'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionBody(QuizQuestion question) {
    switch (question.type) {
      case QuestionType.singleChoice:
      case QuestionType.trueFalse:
        return ListView(
          children: question.options
              .map((o) => RadioListTile<String>(
                    title: Text(o.text),
                    value: o.id,
                    groupValue: _selectedOptionId,
                    onChanged: (v) => setState(() => _selectedOptionId = v),
                  ))
              .toList(),
        );

      case QuestionType.ordering:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Tap the steps in the correct order:'),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                children: question.options.map((o) {
                  final position = _orderingSelection.indexOf(o.id);
                  final picked = position != -1;
                  return ListTile(
                    leading: CircleAvatar(child: Text(picked ? '${position + 1}' : '?')),
                    title: Text(o.text),
                    tileColor: picked ? Theme.of(context).colorScheme.primaryContainer : null,
                    onTap: picked
                        ? () => setState(() => _orderingSelection.remove(o.id))
                        : () => setState(() => _orderingSelection.add(o.id)),
                  );
                }).toList(),
              ),
            ),
          ],
        );

      case QuestionType.matching:
        final rightItems = [...question.options]..shuffle();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Match each item to its description:'),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(
                children: question.options.map((left) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(flex: 2, child: Text(left.text)),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 3,
                          child: DropdownButtonFormField<String>(
                            initialValue: _matchingSelection[left.id],
                            isExpanded: true,
                            decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
                            items: rightItems
                                .map((r) => DropdownMenuItem(
                                      value: r.id,
                                      child: Text(
                                        r.matchText ?? r.text,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ))
                                .toList(),
                            onChanged: (v) => setState(() => _matchingSelection[left.id] = v!),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        );
    }
  }
}

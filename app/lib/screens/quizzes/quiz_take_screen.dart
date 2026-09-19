import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/quiz.dart';
import '../../providers/app_state.dart';
import '../../services/api_client.dart';
import '../../services/quiz_service.dart';
import '../../theme/app_theme.dart';
import 'quiz_result_screen.dart';

/// The whole quiz on one scrollable page — every question, answer inline,
/// no Next/Previous and no separate summary screen to navigate to.
///
/// A "revisit" bookmark on each question and the tiny status grid at the
/// bottom exist so a child can still see and jump between questions without
/// a dedicated screen for it: the grid tiles just scroll the page to the
/// question they represent, since everything is already on this one page.
///
/// Submit is always tappable — there is no disabled state and no static
/// "answer everything" hint. Pressing it while something is unanswered
/// validates instead: it scrolls to the first unanswered question and marks
/// it, the same way a form would. A flagged "revisit" question never blocks
/// submission on its own — the flag is only a personal reminder.
class QuizTakeScreen extends StatefulWidget {
  final Quiz quiz;
  const QuizTakeScreen({super.key, required this.quiz});

  @override
  State<QuizTakeScreen> createState() => _QuizTakeScreenState();
}

class _QuizTakeScreenState extends State<QuizTakeScreen> {
  late final DateTime _startedAt;
  bool _submitting = false;

  /// Every question still unanswered as of the last failed Submit press —
  /// each one shows an inline validation error, not just the first, so one
  /// press surfaces everything left to do instead of the reader having to
  /// press Submit again after fixing each question just to find the next.
  /// A question's own error clears the moment it is answered (see the
  /// `showError` computation in build), not by any separate reset.
  final Set<String> _validationErrorKeys = {};

  // Live answer state, one map per question type, keyed by questionKey.
  // Kept separate rather than one blob so each question type's widget binds
  // to exactly the shape it needs.
  final Map<String, String> _singleChoice = {}; // questionKey -> optionId
  final Map<String, List<String>> _ordering =
      {}; // questionKey -> ordered optionIds (may be partial)
  final Map<String, Map<String, String>> _matching =
      {}; // questionKey -> {leftOptionId: matchOptionId}

  final Set<String> _flaggedForRevisit = {};

  /// One scroll anchor per question, so a tap on a status tile can scroll
  /// straight to that question instead of needing a separate screen.
  late final Map<String, GlobalKey> _anchors = {
    for (final q in widget.quiz.questions) q.questionKey: GlobalKey(),
  };

  @override
  void initState() {
    super.initState();
    _startedAt = DateTime.now();
  }

  bool _isAnswered(QuizQuestion q) {
    switch (q.type) {
      case QuestionType.singleChoice:
      case QuestionType.trueFalse:
        return _singleChoice[q.questionKey] != null;
      case QuestionType.ordering:
        return (_ordering[q.questionKey]?.length ?? 0) == q.options.length;
      case QuestionType.matching:
        return (_matching[q.questionKey]?.length ?? 0) == q.options.length;
    }
  }

  int get _answeredCount => widget.quiz.questions.where(_isAnswered).length;

  Map<String, dynamic> _answerPayload(QuizQuestion q) {
    switch (q.type) {
      case QuestionType.singleChoice:
      case QuestionType.trueFalse:
        return {'optionId': _singleChoice[q.questionKey]};
      case QuestionType.ordering:
        return {'order': _ordering[q.questionKey] ?? const <String>[]};
      case QuestionType.matching:
        final pairs = _matching[q.questionKey] ?? const <String, String>{};
        return {
          'pairs': pairs.entries
              .map((e) => {'optionId': e.key, 'matchOptionId': e.value})
              .toList(),
        };
    }
  }

  void _scrollToQuestion(String questionKey) {
    final context = _anchors[questionKey]?.currentContext;
    if (context == null) return;
    Scrollable.ensureVisible(
      context,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      alignment: 0.08,
    );
  }

  /// What Submit actually does: validate first, and only call [_submit] once
  /// every question has an answer. On failure it does not just say so — it
  /// shows a toast, marks *every* unanswered question at once (not only the
  /// first), and scrolls to the first one — so a quiz with several gaps
  /// takes one Submit press to see all of them, not one press per gap.
  Future<void> _attemptSubmit() async {
    final unanswered = widget.quiz.questions.where((q) => !_isAnswered(q));
    final firstUnanswered = unanswered.firstOrNull;

    if (firstUnanswered != null) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(S.answerAllToSubmit)));
      setState(() {
        _validationErrorKeys
          ..clear()
          ..addAll(unanswered.map((q) => q.questionKey));
      });
      // Let the error banners just added to those cards lay out before
      // scrolling to the first one, so ensureVisible accounts for the
      // extra height they add.
      await Future<void>.delayed(const Duration(milliseconds: 50));
      if (!mounted) return;
      _scrollToQuestion(firstUnanswered.questionKey);
      return;
    }

    setState(_validationErrorKeys.clear);
    await _submit();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final responses = widget.quiz.questions
          .map(
            (q) => {
              'questionKey': q.questionKey,
              'answer': _answerPayload(q),
              'answeredAt': DateTime.now().toUtc().toIso8601String(),
            },
          )
          .toList();

      final result = await QuizService.instance.submitAttempt(
        quiz: widget.quiz,
        startedAt: _startedAt,
        responses: responses,
      );

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => QuizResultScreen(quiz: widget.quiz, result: result),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final questions = widget.quiz.questions;
    final total = questions.length;

    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        appBar: AppBar(title: Text(widget.quiz.title)),
        body: Column(
          children: [
            // Stays put while the questions below scroll — always visible,
            // no separate screen or icon needed to see overall progress.
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: total == 0 ? 0 : _answeredCount / total,
                        minHeight: 7,
                        backgroundColor: AppTheme.primary.withValues(
                          alpha: 0.12,
                        ),
                        valueColor: const AlwaysStoppedAnimation(
                          AppTheme.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    S.answeredOfTotal(_answeredCount, total),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.black.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                children: [
                  for (var i = 0; i < questions.length; i++)
                    // Keeps this question mounted no matter how far the
                    // reader scrolls past it — see _KeepAlive's own doc for
                    // why that's what makes jumping to it from a status
                    // tile (or a failed Submit) actually work.
                    _KeepAlive(
                      child: Padding(
                        key: _anchors[questions[i].questionKey],
                        padding: const EdgeInsets.only(bottom: 14),
                        child: _QuestionCard(
                          number: i + 1,
                          question: questions[i],
                          answered: _isAnswered(questions[i]),
                          showError:
                              _validationErrorKeys.contains(
                                questions[i].questionKey,
                              ) &&
                              !_isAnswered(questions[i]),
                          flagged: _flaggedForRevisit.contains(
                            questions[i].questionKey,
                          ),
                          onToggleFlag: () => setState(() {
                            final key = questions[i].questionKey;
                            _flaggedForRevisit.contains(key)
                                ? _flaggedForRevisit.remove(key)
                                : _flaggedForRevisit.add(key);
                          }),
                          selectedOptionId:
                              _singleChoice[questions[i].questionKey],
                          onSelectOption: (optionId) => setState(
                            () => _singleChoice[questions[i].questionKey] =
                                optionId,
                          ),
                          orderingSelection:
                              _ordering[questions[i].questionKey] ?? const [],
                          onOrderingChanged: (next) => setState(
                            () => _ordering[questions[i].questionKey] = next,
                          ),
                          matchingSelection:
                              _matching[questions[i].questionKey] ?? const {},
                          onMatchingChanged: (next) => setState(
                            () => _matching[questions[i].questionKey] = next,
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                  _StatusAndSubmit(
                    questions: questions,
                    isAnswered: _isAnswered,
                    flagged: _flaggedForRevisit,
                    onTileTap: (q) => _scrollToQuestion(q.questionKey),
                    submitting: _submitting,
                    onSubmitPressed: _attemptSubmit,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Keeps a list item's subtree mounted even when scrolled far outside the
/// viewport, so [Scrollable.ensureVisible] targeting a GlobalKey inside it
/// (see [_QuizTakeScreenState._scrollToQuestion]) always has a live render
/// object to scroll to.
///
/// Without this, `ListView`/`SliverList` disposes an item's Element once it
/// is far enough off-screen — an entirely ordinary scroll-performance
/// optimisation, and exactly why tapping a status tile for a question far
/// from the current scroll position used to do nothing at all: the target's
/// GlobalKey had no `currentContext` left to scroll to, so the attempt
/// silently no-opped instead of erroring.
class _KeepAlive extends StatefulWidget {
  final Widget child;
  const _KeepAlive({required this.child});

  @override
  State<_KeepAlive> createState() => _KeepAliveState();
}

class _KeepAliveState extends State<_KeepAlive>
    with AutomaticKeepAliveClientMixin<_KeepAlive> {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context); // required by AutomaticKeepAliveClientMixin
    return widget.child;
  }
}

class _QuestionCard extends StatelessWidget {
  final int number;
  final QuizQuestion question;
  final bool answered;

  /// True only for the one question a failed Submit attempt landed on —
  /// see QuizTakeScreen._attemptSubmit. Draws a red border and a short
  /// message rather than leaving the reader to work out why they were
  /// scrolled here.
  final bool showError;

  final bool flagged;
  final VoidCallback onToggleFlag;

  final String? selectedOptionId;
  final ValueChanged<String> onSelectOption;

  final List<String> orderingSelection;
  final ValueChanged<List<String>> onOrderingChanged;

  final Map<String, String> matchingSelection;
  final ValueChanged<Map<String, String>> onMatchingChanged;

  const _QuestionCard({
    required this.number,
    required this.question,
    required this.answered,
    required this.showError,
    required this.flagged,
    required this.onToggleFlag,
    required this.selectedOptionId,
    required this.onSelectOption,
    required this.orderingSelection,
    required this.onOrderingChanged,
    required this.matchingSelection,
    required this.onMatchingChanged,
  });

  @override
  Widget build(BuildContext context) {
    // A Material ancestor (not a plain decorated Container) so the
    // RadioListTile/ListTile options below paint their ink splashes and
    // selection tint correctly instead of being hidden behind this card's
    // own background.
    return Material(
      color: Colors.white,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: showError
            ? const BorderSide(color: Color(0xFFD32F2F), width: 1.6)
            : BorderSide(color: AppTheme.deep.withValues(alpha: 0.07)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  '${S.questionNumber} $number',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primary,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: answered
                        ? const Color(0xFF2E7D32).withValues(alpha: 0.12)
                        : AppTheme.deep.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    answered ? S.answered : S.unanswered,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: answered
                          ? const Color(0xFF2E7D32)
                          : Colors.black.withValues(alpha: 0.5),
                    ),
                  ),
                ),
                const Spacer(),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    flagged
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_border_rounded,
                    color: flagged
                        ? const Color(0xFFB26A00)
                        : AppTheme.deep.withValues(alpha: 0.35),
                  ),
                  tooltip: flagged ? S.markedToRevisit : S.markToRevisit,
                  onPressed: onToggleFlag,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              question.prompt,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (showError) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    size: 15,
                    color: Color(0xFFD32F2F),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    S.answerThisQuestion,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFD32F2F),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 10),
            _buildBody(context),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (question.type) {
      case QuestionType.singleChoice:
      case QuestionType.trueFalse:
        return Column(
          children: question.options
              .map(
                (o) => RadioListTile<String>(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(o.text),
                  value: o.id,
                  groupValue: selectedOptionId,
                  onChanged: (v) => onSelectOption(v!),
                ),
              )
              .toList(),
        );

      case QuestionType.ordering:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(S.tapStepsInOrder, style: const TextStyle(fontSize: 12.5)),
            const SizedBox(height: 4),
            ...question.options.map((o) {
              final position = orderingSelection.indexOf(o.id);
              final picked = position != -1;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: CircleAvatar(
                  radius: 14,
                  child: Text(picked ? '${position + 1}' : '?'),
                ),
                title: Text(o.text),
                tileColor: picked
                    ? Theme.of(context).colorScheme.primaryContainer
                    : null,
                onTap: () {
                  final next = List<String>.from(orderingSelection);
                  picked ? next.remove(o.id) : next.add(o.id);
                  onOrderingChanged(next);
                },
              );
            }),
          ],
        );

      case QuestionType.matching:
        final rightItems = [...question.options]..shuffle();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(S.matchEachItem, style: const TextStyle(fontSize: 12.5)),
            const SizedBox(height: 4),
            ...question.options.map((left) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(flex: 2, child: Text(left.text)),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: DropdownButtonFormField<String>(
                        initialValue: matchingSelection[left.id],
                        isExpanded: true,
                        decoration: const InputDecoration(
                          isDense: true,
                          border: OutlineInputBorder(),
                        ),
                        items: rightItems
                            .map(
                              (r) => DropdownMenuItem(
                                value: r.id,
                                child: Text(
                                  r.matchText ?? r.text,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          final next = Map<String, String>.from(
                            matchingSelection,
                          );
                          next[left.id] = v!;
                          onMatchingChanged(next);
                        },
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        );
    }
  }
}

/// The bottom-of-page status strip: a small tile per question — nothing
/// else. No heading, no legend, no "answer everything first" text; the
/// tiles and the Submit button are the whole thing, so this stays out of
/// the child's way while they're still answering.
///
/// Submit is always tappable. What used to be a disabled button with a
/// static hint is now real validation: pressing it while something is
/// unanswered scrolls straight to the first such question and marks it,
/// rather than making the child hunt for what's missing.
class _StatusAndSubmit extends StatelessWidget {
  final List<QuizQuestion> questions;
  final bool Function(QuizQuestion) isAnswered;
  final Set<String> flagged;
  final ValueChanged<QuizQuestion> onTileTap;
  final bool submitting;
  final VoidCallback onSubmitPressed;

  const _StatusAndSubmit({
    required this.questions,
    required this.isAnswered,
    required this.flagged,
    required this.onTileTap,
    required this.submitting,
    required this.onSubmitPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.deep.withValues(alpha: 0.07)),
      ),
      child: Column(
        children: [
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            // A max extent, not a fixed column count: tiles stay small and
            // consistent (~34px) regardless of how many questions there
            // are or how wide the phone is, rather than growing to fill
            // the row on a short quiz. Big enough for the number to read
            // easily and for a thumb to hit reliably — smaller than this
            // and both start to fail.
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 34,
              mainAxisSpacing: 7,
              crossAxisSpacing: 7,
              childAspectRatio: 1,
            ),
            itemCount: questions.length,
            itemBuilder: (context, index) {
              final q = questions[index];
              return _StatusTile(
                number: index + 1,
                answered: isAnswered(q),
                flaggedForRevisit: flagged.contains(q.questionKey),
                onTap: () => onTileTap(q),
              );
            },
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: submitting ? null : onSubmitPressed,
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.deep,
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(S.submitQuiz),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusTile extends StatelessWidget {
  final int number;
  final bool answered;
  final bool flaggedForRevisit;
  final VoidCallback onTap;

  const _StatusTile({
    required this.number,
    required this.answered,
    required this.flaggedForRevisit,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: answered
          ? AppTheme.primary
          : AppTheme.deep.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(7),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(7),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Text(
              '$number',
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w800,
                color: answered
                    ? Colors.white
                    : AppTheme.deep.withValues(alpha: 0.65),
              ),
            ),
            if (flaggedForRevisit)
              Positioned(
                right: 1,
                top: 1,
                child: Icon(
                  Icons.bookmark_rounded,
                  size: 9,
                  color: answered ? Colors.white : const Color(0xFFB26A00),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

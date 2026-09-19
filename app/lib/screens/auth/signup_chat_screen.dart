import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;

import '../../models/signup_question.dart';
import '../../services/profile_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/error_banner.dart';
import 'signup_loading_screen.dart';
import 'terms_screen.dart';

class _ChatMessage {
  static int _nextId = 0;

  /// Unique per message instance, not per position — used as the bubble's
  /// list key so a message that's removed and later replaced by a new one
  /// (editing an earlier answer truncates and re-asks) always gets a fresh
  /// widget and plays its entrance animation again, rather than Flutter
  /// reusing the old bubble's state because it happened to land back at the
  /// same list index.
  final int id = _nextId++;

  final String text;
  final bool isUser;

  /// Which [SignupQuestion.key] this message answers — only set on a user
  /// bubble that answered a real question (not the "I Agree" bubble), and
  /// what the edit pencil next to it needs to reopen that question.
  final String? questionKey;

  _ChatMessage(this.text, {required this.isUser, this.questionKey});
}

/// Conversational collection of the details needed alongside email/password
/// (see signup_question.dart for the field list and validation). One
/// question at a time, each answered before the next appears — not a form
/// dumped on screen at once. The actual account-creation call happens on
/// [SignupLoadingScreen], reached once the last question is answered.
class SignupChatScreen extends StatefulWidget {
  final String email;
  final String password;

  const SignupChatScreen({
    super.key,
    required this.email,
    required this.password,
  });

  @override
  State<SignupChatScreen> createState() => _SignupChatScreenState();
}

class _SignupChatScreenState extends State<SignupChatScreen> {
  final List<_ChatMessage> _messages = [];
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final Map<String, String> _answers = {};

  int _index = 0;
  String? _error;
  bool _showingTerms = false;

  @override
  void initState() {
    super.initState();
    _messages.add(
      _ChatMessage(
        "A few details about the child will help us better understand their needs. Your information will remain private.",
        isUser: false,
      ),
    );
    _askCurrentQuestion();
  }

  SignupQuestion get _current => signupQuestions[_index];
  bool get _isLastQuestion => _index == signupQuestions.length - 1;

  void _askTerms() {
    _messages.add(
      _ChatMessage(
        'One last thing — please read our Terms & Conditions and tap "I Agree" to create the account.',
        isUser: false,
      ),
    );
  }

  Future<void> _openTerms() async {
    final agreed = await Navigator.of(
      context,
    ).push<bool>(MaterialPageRoute(builder: (_) => const TermsScreen()));
    if (agreed == true) _respondToTerms();
  }

  Future<void> _respondToTerms() async {
    setState(() {
      _messages.add(_ChatMessage('I Agree', isUser: true));
    });
    _scrollToEnd();

    // Sign-up itself can't persist these (no session yet — the backend runs
    // autoSignIn: false), so they're stashed and flushed on first sign-in.
    await ProfileService.instance.stashSignupAnswers(_answers);
    if (!mounted) return;

    // A regular push, not pushReplacement — if account creation fails, the
    // loading screen pops back to this chat (still showing the terms
    // prompt, since state here isn't destroyed) with the error to show.
    final error = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => SignupLoadingScreen(
          email: widget.email,
          password: widget.password,
          name: _answers['name'] ?? '',
        ),
      ),
    );
    if (!mounted) return;
    if (error != null) {
      setState(() => _error = error);
      _scrollToEnd();
    }
  }

  void _askCurrentQuestion() {
    _messages.add(_ChatMessage(_current.prompt, isUser: false));
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _submitAnswer(String rawValue) {
    final error = validateSignupAnswer(
      _current,
      rawValue,
      priorAnswers: _answers,
    );
    if (error != null) {
      setState(() => _error = error);
      return;
    }

    setState(() {
      _error = null;
      _answers[_current.key] = rawValue.trim();
      _messages.add(
        _ChatMessage(rawValue.trim(), isUser: true, questionKey: _current.key),
      );
      _controller.clear();
    });
    _scrollToEnd();

    if (_isLastQuestion) {
      setState(() {
        _showingTerms = true;
        _askTerms();
      });
      _scrollToEnd();
      return;
    }

    setState(() {
      _index += 1;
      _askCurrentQuestion();
    });
    _scrollToEnd();
  }

  /// Reopens an already-answered question from its edit pencil — rewinds
  /// the chat to just after that question was asked (dropping the old
  /// answer and anything asked after it, since a changed answer can
  /// invalidate what came later, e.g. a diagnosis year checked against the
  /// date of birth) and lets the parent answer it again.
  void _editAnswer(String key) {
    final questionIndex = signupQuestions.indexWhere((q) => q.key == key);
    final userMsgIndex = _messages.indexWhere(
      (m) => m.isUser && m.questionKey == key,
    );
    if (questionIndex == -1 || userMsgIndex == -1) return;

    final previousAnswer = _answers[key] ?? '';

    setState(() {
      _messages.removeRange(userMsgIndex, _messages.length);
      for (final q in signupQuestions.skip(questionIndex)) {
        _answers.remove(q.key);
      }
      _index = questionIndex;
      _showingTerms = false;
      _error = null;
      _controller.text = previousAnswer;
    });
    _scrollToEnd();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Before We Begin...')),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.center,
            radius: 1.2,
            colors: [AppTheme.primary, AppTheme.accent, AppTheme.lightest],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(16),
                itemCount: _messages.length,
                itemBuilder: (context, i) => _ChatBubble(
                  key: ValueKey(_messages[i].id),
                  message: _messages[i],
                  onEdit: _messages[i].questionKey == null
                      ? null
                      : () => _editAnswer(_messages[i].questionKey!),
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: ErrorBanner(message: _error!),
              ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _showingTerms
                    ? _TermsPromptInput(onOpenTerms: _openTerms)
                    : _AnswerInput(
                        question: _current,
                        controller: _controller,
                        onSubmit: _submitAnswer,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A single bubble. Plays its own slide-up-and-fade entrance once when
/// first built — new messages arrive smoothly rather than popping in, and
/// because it's keyed by the message's own id (not its position), editing
/// an earlier answer and having later bubbles reappear plays this again for
/// them rather than only for messages truly new to the whole chat.
class _ChatBubble extends StatefulWidget {
  final _ChatMessage message;

  /// Present only for a user bubble that answered a real question — shows
  /// a small pencil to reopen and change that answer.
  final VoidCallback? onEdit;

  const _ChatBubble({super.key, required this.message, this.onEdit});

  @override
  State<_ChatBubble> createState() => _ChatBubbleState();
}

class _ChatBubbleState extends State<_ChatBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  )..forward();
  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOut,
  );
  late final Animation<Offset> _slide = Tween(
    begin: const Offset(0, 0.18),
    end: Offset.zero,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _showActions(BuildContext context) async {
    final action = await showModalBottomSheet<_BubbleAction>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.onEdit != null)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Edit'),
                onTap: () => Navigator.of(sheetContext).pop(_BubbleAction.edit),
              ),
            ListTile(
              leading: const Icon(Icons.copy_outlined),
              title: const Text('Copy'),
              onTap: () => Navigator.of(sheetContext).pop(_BubbleAction.copy),
            ),
          ],
        ),
      ),
    );

    switch (action) {
      case _BubbleAction.edit:
        widget.onEdit?.call();
      case _BubbleAction.copy:
        await Clipboard.setData(ClipboardData(text: widget.message.text));
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Copied'),
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 1),
            ),
          );
        }
      case null:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    final alignment = message.isUser
        ? Alignment.centerRight
        : Alignment.centerLeft;
    final color = message.isUser ? AppTheme.primary : Colors.white;
    final textColor = message.isUser ? Colors.white : Colors.black;

    final bubble = Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      constraints: BoxConstraints(
        maxWidth: MediaQuery.of(context).size.width * 0.75,
      ),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(18),
          topRight: const Radius.circular(18),
          bottomLeft: Radius.circular(message.isUser ? 18 : 4),
          bottomRight: Radius.circular(message.isUser ? 4 : 18),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        message.text,
        style: TextStyle(color: textColor, fontSize: 14, height: 1.35),
      ),
    );

    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: Align(
          alignment: alignment,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: GestureDetector(
              onLongPress: () => _showActions(context),
              child: bubble,
            ),
          ),
        ),
      ),
    );
  }
}

enum _BubbleAction { edit, copy }

/// The input control for the current question — a text field, a date
/// picker, or choice chips, depending on `question.type`.
class _AnswerInput extends StatelessWidget {
  final SignupQuestion question;
  final TextEditingController controller;
  final void Function(String value) onSubmit;

  const _AnswerInput({
    required this.question,
    required this.controller,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    if (question.type == SignupAnswerType.choice) {
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: (question.choices ?? [])
            .map(
              (choice) => ActionChip(
                label: Text(
                  choice,
                  style: const TextStyle(color: Colors.black),
                ),
                backgroundColor: Colors.white,
                side: const BorderSide(color: AppTheme.accent),
                onPressed: () => onSubmit(choice),
              ),
            )
            .toList(),
      );
    }

    if (question.type == SignupAnswerType.date) {
      return Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              readOnly: true,
              style: const TextStyle(color: Colors.black, fontSize: 16),
              decoration: _answerBoxDecoration('Tap to choose a date'),
              onTap: () async {
                final now = DateTime.now();
                final picked = await showDatePicker(
                  context: context,
                  initialDate: DateTime(now.year - 10),
                  firstDate: DateTime(now.year - 25),
                  lastDate: now,
                );
                if (picked != null) {
                  controller.text = picked.toIso8601String().split('T').first;
                }
              },
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: () => onSubmit(controller.text),
            style: FilledButton.styleFrom(
              minimumSize: const Size(56, 52),
              padding: EdgeInsets.zero,
            ),
            child: const Icon(Icons.arrow_forward, size: 20),
          ),
        ],
      );
    }

    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            keyboardType: question.type == SignupAnswerType.year
                ? TextInputType.number
                : TextInputType.text,
            style: const TextStyle(color: Colors.black, fontSize: 16),
            decoration: _answerBoxDecoration('Type your answer'),
            onSubmitted: onSubmit,
          ),
        ),
        const SizedBox(width: 8),
        FilledButton(
          onPressed: () => onSubmit(controller.text),
          style: FilledButton.styleFrom(
            minimumSize: const Size(56, 52),
            padding: EdgeInsets.zero,
          ),
          child: const Icon(Icons.arrow_forward, size: 20),
        ),
      ],
    );
  }
}

/// Single "read the terms" prompt shown once all questions are answered —
/// tapping it opens [TermsScreen], whose own "I Agree" button is the actual
/// gate before the account is created (see [SignupChatScreen._openTerms]).
class _TermsPromptInput extends StatelessWidget {
  final VoidCallback onOpenTerms;
  const _TermsPromptInput({required this.onOpenTerms});

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onOpenTerms,
      icon: const Icon(Icons.menu_book_outlined, size: 18),
      label: const Text('Read Terms & Conditions'),
    );
  }
}

/// A plain rectangular white box — distinct from the rounded, tinted
/// fields used on the auth screens, per how the chat's answer field was
/// asked to look.
InputDecoration _answerBoxDecoration(String hint) {
  return InputDecoration(
    hintText: hint,
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: AppTheme.accent.withValues(alpha: 0.5)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: AppTheme.accent.withValues(alpha: 0.5)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: AppTheme.primary, width: 1.6),
    ),
  );
}

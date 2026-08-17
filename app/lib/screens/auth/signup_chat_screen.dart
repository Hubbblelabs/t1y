import 'package:flutter/material.dart';

import '../../models/signup_question.dart';
import '../../models/terms_content.dart';
import '../../theme/app_theme.dart';
import '../../widgets/infinite_grid_background.dart';
import 'get_started_screen.dart';
import 'signup_loading_screen.dart';
import 'terms_screen.dart';

class _ChatMessage {
  final String text;
  final bool isUser;
  const _ChatMessage(this.text, {required this.isUser});
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
  bool _termsDeclined = false;

  @override
  void initState() {
    super.initState();
    _messages.add(
      _ChatMessage(
        "A few details about the child before we start — this helps your care team, and stays private to this study.",
        isUser: false,
      ),
    );
    _askCurrentQuestion();
  }

  SignupQuestion get _current => signupQuestions[_index];
  bool get _isLastQuestion => _index == signupQuestions.length - 1;

  void _askTerms() {
    final bullets = termsSummary.map((t) => '• $t').join('\n');
    _messages.add(
      _ChatMessage(
        'One last thing — please review and accept these terms before we create the account:\n\n$bullets',
        isUser: false,
      ),
    );
  }

  void _respondToTerms(bool accepted) {
    setState(() {
      _messages.add(
        _ChatMessage(accepted ? 'I Accept' : 'I Do Not Accept', isUser: true),
      );
    });
    _scrollToEnd();

    if (!accepted) {
      setState(() {
        _termsDeclined = true;
        _messages.add(
          _ChatMessage(
            "You can't create an account without accepting the terms, so we can't continue right now. "
            "You're welcome to come back any time.",
            isUser: false,
          ),
        );
      });
      _scrollToEnd();
      Future.delayed(const Duration(seconds: 2), () {
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const GetStartedScreen()),
          (route) => false,
        );
      });
      return;
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => SignupLoadingScreen(
          email: widget.email,
          password: widget.password,
          name: '${_answers['firstName']} ${_answers['lastName']}',
        ),
      ),
    );
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
    final error = validateSignupAnswer(_current, rawValue);
    if (error != null) {
      setState(() => _error = error);
      return;
    }

    setState(() {
      _error = null;
      _answers[_current.key] = rawValue.trim();
      _messages.add(_ChatMessage(rawValue.trim(), isUser: true));
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('A few details before we start')),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppTheme.lightest, AppTheme.accent],
          ),
        ),
        child: Stack(
          children: [
            const Positioned.fill(child: InfiniteGridBackground()),
            Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, i) =>
                        _ChatBubble(message: _messages[i]),
                  ),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                  ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: _termsDeclined
                        ? const SizedBox.shrink()
                        : _showingTerms
                        ? _TermsResponseInput(onRespond: _respondToTerms)
                        : _AnswerInput(
                            question: _current,
                            controller: _controller,
                            onSubmit: _submitAnswer,
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  final _ChatMessage message;
  const _ChatBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final alignment = message.isUser
        ? Alignment.centerRight
        : Alignment.centerLeft;
    final color = message.isUser ? AppTheme.primary : Colors.white;
    final textColor = message.isUser ? Colors.white : Colors.black;

    return Align(
      alignment: alignment,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
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
      ),
    );
  }
}

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

/// Read-more link plus Accept/Decline chips, shown once all questions are
/// answered — the final gate before the account is actually created.
class _TermsResponseInput extends StatelessWidget {
  final void Function(bool accepted) onRespond;
  const _TermsResponseInput({required this.onRespond});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const TermsScreen())),
            icon: const Icon(Icons.menu_book_outlined, size: 18),
            label: const Text('Read more — full Terms & Conditions'),
            style: TextButton.styleFrom(foregroundColor: AppTheme.primary),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => onRespond(false),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.deep,
                  side: const BorderSide(color: AppTheme.accent),
                ),
                child: const Text('I Do Not Accept'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: () => onRespond(true),
                child: const Text('I Accept'),
              ),
            ),
          ],
        ),
      ],
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

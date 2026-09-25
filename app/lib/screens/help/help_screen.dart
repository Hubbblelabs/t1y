import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/support.dart';
import '../../services/api_client.dart';
import '../../services/support_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/relative_time.dart';
import '../../providers/app_state.dart';
import '../../widgets/error_banner.dart';
import 'new_question_screen.dart';
import 'thread_screen.dart';

/// A parent's questions to the study team, and where each one stands.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  List<SupportThread>? _threads;
  int? _remainingToday;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await SupportService.instance.list();
      if (!mounted) return;
      setState(() {
        _threads = result.threads;
        _remainingToday = result.remainingToday;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = S.couldNotLoad);
    }
  }

  Future<void> _ask() async {
    final asked = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => NewQuestionScreen(remainingToday: _remainingToday),
      ),
    );
    if (asked == true) _load();
  }

  Future<void> _open(SupportThread thread) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ThreadScreen(threadId: thread.id)),
    );
    // Opening marks answers read, and a reply may have been sent.
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final threads = _threads;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(title: Text(S.helpAndSupport)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _ask,
        backgroundColor: AppTheme.deep,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.edit_outlined),
        label: Text(S.askAQuestion),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            Text(
              S.helpIntro,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: Colors.black.withValues(alpha: 0.6),
              ),
            ),
            if (_remainingToday != null) ...[
              const SizedBox(height: 6),
              Text(
                S.messagesLeftToday(_remainingToday!, 3),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.primary,
                ),
              ),
            ],
            const SizedBox(height: 16),
            if (_error != null && threads == null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: _load, child: Text(S.tryAgain)),
            ] else if (threads == null)
              const Padding(
                padding: EdgeInsets.only(top: 60),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (threads.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 60),
                child: Text(
                  S.noQuestionsYet,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.black.withValues(alpha: 0.5)),
                ),
              )
            else
              for (final thread in threads) ...[
                _ThreadTile(thread: thread, onTap: () => _open(thread)),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }
}

/// The chip a question wears: sent, seen, replied or closed.
class StateChip extends StatelessWidget {
  final SupportState state;
  const StateChip({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (state) {
      SupportState.sent => (S.stateSent, const Color(0xFF6B7A8C)),
      SupportState.seen => (S.stateSeen, const Color(0xFFB26A00)),
      SupportState.replied => (S.stateReplied, const Color(0xFF2E7D32)),
      SupportState.closed => (S.stateClosed, const Color(0xFF6B7A8C)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _ThreadTile extends StatelessWidget {
  final SupportThread thread;
  final VoidCallback onTap;

  const _ThreadTile({required this.thread, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final last = thread.messages.isEmpty ? null : thread.messages.last;
    final unread = thread.unreadAnswers > 0;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: unread
                ? AppTheme.primary.withValues(alpha: 0.5)
                : AppTheme.deep.withValues(alpha: 0.08),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    thread.subject,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.deep,
                    ),
                  ),
                ),
                if (unread) ...[
                  Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      S.newAnswer,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
                StateChip(state: thread.state),
              ],
            ),
            if (last != null) ...[
              const SizedBox(height: 6),
              Text(
                last.body,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.35,
                  color: Colors.black.withValues(alpha: 0.55),
                ),
              ),
            ],
            const SizedBox(height: 6),
            Text(
              relativeTime(
                thread.lastMessageAt,
                locale: AppState.instance.locale,
              ),
              style: TextStyle(
                fontSize: 11.5,
                color: Colors.black.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/support.dart';
import '../../providers/app_state.dart';
import '../../services/api_client.dart';
import '../../services/support_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/relative_time.dart';
import '../../widgets/error_banner.dart';
import 'help_screen.dart' show StateChip;

/// One conversation with the study team.
///
/// Opening it is what marks the team's answers as read on the server, which is
/// what the team's dashboard then shows beside them.
class ThreadScreen extends StatefulWidget {
  final String threadId;

  const ThreadScreen({super.key, required this.threadId});

  @override
  State<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends State<ThreadScreen> {
  SupportThread? _thread;
  final _reply = TextEditingController();
  final _scroll = ScrollController();

  bool _sending = false;
  String? _error;

  /// Messages left today, if known; the server enforces the limit regardless.
  int? _remaining;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reply.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final thread = await SupportService.instance.thread(widget.threadId);
      if (!mounted) return;
      setState(() {
        _thread = thread;
        _error = null;
      });
      SupportService.instance.remainingToday().then((left) {
        if (mounted) setState(() => _remaining = left);
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.jumpTo(_scroll.position.maxScrollExtent);
        }
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _send() async {
    final text = _reply.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await SupportService.instance.reply(widget.threadId, body: text);
      _reply.clear();
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final thread = _thread;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        title: Text(
          thread?.subject ?? S.helpAndSupport,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          if (thread != null)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(child: StateChip(state: thread.state)),
            ),
        ],
      ),
      body: thread == null
          ? (_error != null
                ? Padding(
                    padding: const EdgeInsets.all(20),
                    child: ErrorBanner(message: _error!),
                  )
                : const Center(child: CircularProgressIndicator()))
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    controller: _scroll,
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final message in thread.messages)
                        _Bubble(message: message),
                    ],
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
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                    child: (_remaining != null && _remaining! <= 0)
                        ? Padding(
                            padding: const EdgeInsets.symmetric(
                              vertical: 8,
                              horizontal: 4,
                            ),
                            child: Text(
                              S.dailyLimitReached,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12.5,
                                height: 1.4,
                                color: Colors.black.withValues(alpha: 0.55),
                              ),
                            ),
                          )
                        : Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_remaining != null)
                                Padding(
                                  padding: const EdgeInsets.only(
                                    left: 6,
                                    bottom: 4,
                                  ),
                                  child: Text(
                                    S.messagesLeftToday(_remaining!, 3),
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      color: Colors.black.withValues(
                                        alpha: 0.5,
                                      ),
                                    ),
                                  ),
                                ),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _reply,
                                      minLines: 1,
                                      maxLines: 4,
                                      maxLength: 1000,
                                      buildCounter:
                                          (
                                            _, {
                                            required currentLength,
                                            required isFocused,
                                            maxLength,
                                          }) => null,
                                      style: const TextStyle(
                                        color: Colors.black,
                                      ),
                                      decoration: InputDecoration(
                                        hintText: S.writeReply,
                                        filled: true,
                                        fillColor: Colors.white,
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              horizontal: 16,
                                              vertical: 12,
                                            ),
                                        border: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(
                                            22,
                                          ),
                                          borderSide: BorderSide.none,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton.filled(
                                    onPressed: _sending ? null : _send,
                                    style: IconButton.styleFrom(
                                      backgroundColor: AppTheme.deep,
                                    ),
                                    icon: _sending
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.send_rounded,
                                            size: 20,
                                          ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _Bubble extends StatelessWidget {
  final SupportMessage message;

  const _Bubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final mine = !message.fromTeam;
    final locale = AppState.instance.locale;

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        decoration: BoxDecoration(
          color: mine ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 5,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              mine ? S.you : S.studyTeam,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: mine ? Colors.white70 : AppTheme.primary,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              message.body,
              style: TextStyle(
                fontSize: 14,
                height: 1.4,
                color: mine ? Colors.white : Colors.black,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              // For a parent's own message, whether the team has opened it —
              // the "seen" tick.
              mine && message.readAt != null
                  ? '${relativeTime(message.createdAt, locale: locale)} · ${S.stateSeen}'
                  : relativeTime(message.createdAt, locale: locale),
              style: TextStyle(
                fontSize: 10.5,
                color: mine
                    ? Colors.white70
                    : Colors.black.withValues(alpha: 0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

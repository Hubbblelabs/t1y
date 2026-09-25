import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/api_client.dart';
import '../../services/support_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/error_banner.dart';

/// Asking the study team something new: one box for the message, nothing else.
///
/// There is no title to invent and no link or file to attach — a parent says
/// what they need in a few sentences and the team reads it. The question is
/// filed against whichever child the parent is signed in as, so it is
/// automatically about the right one.
class NewQuestionScreen extends StatefulWidget {
  /// Messages left today, if known. The server enforces the limit regardless;
  /// this only lets the screen say so up front instead of after a failed send.
  final int? remainingToday;

  const NewQuestionScreen({super.key, this.remainingToday});

  @override
  State<NewQuestionScreen> createState() => _NewQuestionScreenState();
}

class _NewQuestionScreenState extends State<NewQuestionScreen> {
  final _body = TextEditingController();

  bool _sending = false;
  String? _error;

  bool get _outOfMessages =>
      widget.remainingToday != null && widget.remainingToday! <= 0;

  @override
  void dispose() {
    _body.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    FocusScope.of(context).unfocus();

    if (_body.text.trim().isEmpty) {
      setState(() => _error = S.needMessage);
      return;
    }

    setState(() {
      _sending = true;
      _error = null;
    });

    try {
      await SupportService.instance.open(body: _body.text.trim());
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(S.askAQuestion)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 16),
          ],
          if (_outOfMessages)
            ErrorBanner(message: S.dailyLimitReached)
          else ...[
            TextField(
              controller: _body,
              minLines: 6,
              maxLines: 12,
              maxLength: 1000,
              autofocus: true,
              style: const TextStyle(color: Colors.black),
              decoration: InputDecoration(
                hintText: S.supportHint,
                hintMaxLines: 4,
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(
                    color: AppTheme.deep.withValues(alpha: 0.14),
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(
                    color: AppTheme.deep.withValues(alpha: 0.14),
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(
                    color: AppTheme.primary,
                    width: 1.6,
                  ),
                ),
              ),
            ),
            if (widget.remainingToday != null) ...[
              const SizedBox(height: 4),
              Text(
                S.messagesLeftToday(widget.remainingToday!, 3),
                style: TextStyle(
                  fontSize: 12,
                  color: AppTheme.inkSoft,
                ),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _sending ? null : _send,
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.deep,
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(S.send),
            ),
          ],
        ],
      ),
    );
  }
}

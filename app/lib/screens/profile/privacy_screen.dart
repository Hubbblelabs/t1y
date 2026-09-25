import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/privacy_content.dart';
import '../../services/api_client.dart';
import '../../services/profile_service.dart';
import '../../services/session_actions.dart';
import '../../theme/app_theme.dart';
import '../../widgets/error_banner.dart';
import 'profile_details_screen.dart';

/// "How your data is used" — the privacy notice, in the app's language.
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(S.howDataUsed),
        backgroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          for (final section in privacySections) ...[
            Text(
              section.title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppTheme.deep,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              section.body,
              style: const TextStyle(
                fontSize: 14.5,
                height: 1.55,
                color: AppTheme.ink,
              ),
            ),
            const SizedBox(height: 20),
          ],
        ],
      ),
    );
  }
}

/// "Correct or delete your data": fix the details, or delete the account.
///
/// Deleting is in the app because Google Play requires any app that lets
/// people create an account to let them delete it from inside the app too.
class DataRightsScreen extends StatelessWidget {
  const DataRightsScreen({super.key});

  Future<void> _correct(BuildContext context) async {
    final me = await ProfileService.instance.me();
    if (me == null || !context.mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProfileDetailsScreen(me: me, startEditing: true),
      ),
    );
  }

  Future<void> _delete(BuildContext context) async {
    final deleted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _DeleteDialog(),
    );
    if (deleted != true || !context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(S.accountDeleted),
        actions: [
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
            onPressed: () => Navigator.of(context).pop(),
            child: Text(S.close),
          ),
        ],
      ),
    );
    await SessionActions.signOut();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(S.correctOrDelete),
        backgroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.edit_note_rounded, color: AppTheme.deep),
            title: Text(
              S.correctMyDetails,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w700,
                color: AppTheme.ink,
              ),
            ),
            subtitle: Text(
              S.correctMyDetailsSubtitle,
              style: const TextStyle(fontSize: 13, color: AppTheme.inkSoft),
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => _correct(context),
          ),
          const Divider(height: 32),
          Text(
            S.deleteAccount,
            style: const TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFFC62828),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            S.deleteAccountBody,
            style: const TextStyle(fontSize: 14, height: 1.5, color: AppTheme.ink),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => _delete(context),
            icon: const Icon(Icons.delete_forever_outlined, color: Color(0xFFC62828)),
            label: Text(
              S.deleteAccount,
              style: const TextStyle(color: Color(0xFFC62828)),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFFC62828)),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeleteDialog extends StatefulWidget {
  const _DeleteDialog();

  @override
  State<_DeleteDialog> createState() => _DeleteDialogState();
}

class _DeleteDialogState extends State<_DeleteDialog> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_password.text.isEmpty) {
      setState(() => _error = S.deletePasswordPrompt);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ProfileService.instance.deleteAccount(_password.text);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = S.couldNotReach;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(S.deleteConfirmTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(S.deletePasswordPrompt),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            autofocus: true,
            decoration: InputDecoration(labelText: S.password),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            ErrorBanner(message: _error!),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: Text(S.cancel),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFC62828),
            minimumSize: const Size(96, 44),
          ),
          onPressed: _busy ? null : _confirm,
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(S.deleteForever),
        ),
      ],
    );
  }
}

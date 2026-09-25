import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_background.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/wave_header.dart';
import '../home/home_shell.dart';

/// Forced first-login step for an account activated with a temporary
/// (dummy) password — set by an admin either activating a single
/// participant or bulk-importing many (see `mustChangePassword` on the
/// backend `User` model). Not dismissible: no back button, and success is
/// the only way out, straight into [HomeShell].
class ChangePasswordScreen extends StatefulWidget {
  final String currentPassword;

  const ChangePasswordScreen({super.key, required this.currentPassword});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;
  bool _submitting = false;

  static const _minLength = 12;
  static const _maxLength = 128;

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final newPassword = _newController.text;
    final confirm = _confirmController.text;

    if (newPassword.length < _minLength) {
      setState(() => _error = 'Password must be at least $_minLength characters.');
      return;
    }
    if (newPassword.length > _maxLength) {
      setState(() => _error = 'Password must be at most $_maxLength characters.');
      return;
    }
    if (newPassword != confirm) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    if (newPassword == widget.currentPassword) {
      setState(() => _error = 'Choose a password different from the one you signed in with.');
      return;
    }

    setState(() {
      _error = null;
      _submitting = true;
    });

    try {
      await AuthService.instance.changePassword(
        currentPassword: widget.currentPassword,
        newPassword: newPassword,
      );
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (_) => false,
      );
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not reach the server. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Mandatory — no way back to a screen that thinks sign-in already
      // finished while the account still carries a shared/dummy password.
      canPop: false,
      child: Scaffold(
        body: AuthBackground(
          child: SafeArea(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const WaveHeader(
                    title: 'Welcome to T1D Prajana Yandra',
                    subtitle: 'Please set your own password to continue',
                    showBack: false,
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.info_outline, size: 18, color: AppTheme.primary),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  "You signed in with a temporary password given by your care "
                                  "coordinator. For your account's safety, set a new password "
                                  "only you know before continuing.",
                                  style: TextStyle(
                                    fontSize: 13,
                                    height: 1.4,
                                    color: AppTheme.deep.withValues(alpha: 0.85),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (_error != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(color: Colors.red, fontSize: 13),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        LabeledField(
                          icon: Icons.lock_outline,
                          label: 'New password',
                          hint: 'Set your new password',
                          controller: _newController,
                          obscureText: true,
                          autofocus: true,
                        ),
                        const SizedBox(height: 20),
                        LabeledField(
                          icon: Icons.lock_outline,
                          label: 'Confirm new password',
                          hint: 'Re-type your new password',
                          controller: _confirmController,
                          obscureText: true,
                          onSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 32),
                        FilledButton(
                          onPressed: _submitting ? null : _submit,
                          child: _submitting
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                                )
                              : const Text('Change password & continue'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

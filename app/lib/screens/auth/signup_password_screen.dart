import 'package:flutter/material.dart';

import '../../widgets/auth_background.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/wave_header.dart';
import 'signup_chat_screen.dart';

/// New-user branch: set a password, confirm it, then move into the
/// conversational detail-collection step.
///
/// Client-side length rule mirrors the backend's actual constraint
/// (`emailAndPassword.minPasswordLength`/`maxPasswordLength`, see
/// api/lib/auth/auth.ts) so a password accepted here is never rejected by
/// the server, and vice versa.
class SignupPasswordScreen extends StatefulWidget {
  final String email;
  const SignupPasswordScreen({super.key, required this.email});

  @override
  State<SignupPasswordScreen> createState() => _SignupPasswordScreenState();
}

class _SignupPasswordScreenState extends State<SignupPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _error;

  static const _minLength = 12;
  static const _maxLength = 128;

  void _continue() {
    FocusScope.of(context).unfocus();
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    if (password.length < _minLength) {
      setState(
        () => _error = 'Password must be at least $_minLength characters.',
      );
      return;
    }
    if (password.length > _maxLength) {
      setState(
        () => _error = 'Password must be at most $_maxLength characters.',
      );
      return;
    }
    if (password != confirm) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }

    setState(() => _error = null);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            SignupChatScreen(email: widget.email, password: password),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                WaveHeader(
                  title: 'Create Account',
                  subtitle: widget.email,
                  showBack: true,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      LabeledField(
                        icon: Icons.lock_outline,
                        label: 'New password',
                        hint: 'Set your password',
                        controller: _passwordController,
                        obscureText: true,
                        autofocus: true,
                      ),
                      const SizedBox(height: 20),
                      LabeledField(
                        icon: Icons.lock_outline,
                        label: 'Confirm password',
                        hint: 'Re-type your password',
                        controller: _confirmController,
                        obscureText: true,
                        onSubmitted: (_) => _continue(),
                      ),
                      const SizedBox(height: 32),
                      FilledButton(
                        onPressed: _continue,
                        child: const Text('Continue'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

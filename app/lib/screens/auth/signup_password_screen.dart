import 'package:flutter/material.dart';

import '../../widgets/auth_background.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/wave_header.dart';
import 'signup_chat_screen.dart';

/// New-user branch: set a password, confirm it, then move into the
/// conversational detail-collection step.
///
/// Client-side rule (per product request): 8+ characters with at least one
/// uppercase letter, one digit, and one special character. NOTE: the
/// backend's `minPasswordLength` is still 12 (see api/lib/auth/auth.ts) —
/// this screen no longer matches it, so an 8-11 character password that
/// passes here will still be rejected by the server. Worth reconciling
/// before this ships; flagging rather than silently changing the backend.
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

  static const _minLength = 8;
  static final _upperCase = RegExp(r'[A-Z]');
  static final _digit = RegExp(r'[0-9]');
  static final _special = RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]/\\;]');

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
    if (!_upperCase.hasMatch(password) ||
        !_digit.hasMatch(password) ||
        !_special.hasMatch(password)) {
      setState(
        () => _error =
            'Password needs an uppercase letter, a number, and a special character.',
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
                        hint: '8+ chars, 1 uppercase, 1 number, 1 symbol',
                        controller: _passwordController,
                        obscureText: true,
                        autofocus: true,
                      ),
                      const SizedBox(height: 20),
                      LabeledField(
                        icon: Icons.lock_outline,
                        label: 'Confirm password',
                        hint: 'Re-enter your password',
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

import 'package:flutter/material.dart';

import '../../widgets/auth_background.dart';
import '../../l10n/strings.dart';
import '../../widgets/bilingual.dart';
import '../../widgets/error_banner.dart';
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
      setState(() => _error = S.bothText(() => S.passwordTooShort(_minLength)));
      return;
    }
    if (password.length > _maxLength) {
      setState(() => _error = S.bothText(() => S.passwordTooLong(_maxLength)));
      return;
    }
    if (password != confirm) {
      setState(() => _error = S.bothText(() => S.passwordsDontMatch));
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
                  title: S.both(() => S.createAccount).en,
                  titleTa: S.both(() => S.createAccount).ta,
                  subtitle: widget.email,
                  showBack: true,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        ErrorBanner(message: _error!),
                        const SizedBox(height: 16),
                      ],
                      LabeledField(
                        icon: Icons.lock_outline,
                        label: S.both(() => S.newPassword).en,
                        labelTa: S.both(() => S.newPassword).ta,
                        hint: S.both(() => S.setYourPassword).en,
                        controller: _passwordController,
                        obscureText: true,
                        autofocus: true,
                      ),
                      const SizedBox(height: 20),
                      LabeledField(
                        icon: Icons.lock_outline,
                        label: S.both(() => S.confirmPassword).en,
                        labelTa: S.both(() => S.confirmPassword).ta,
                        hint: S.both(() => S.retypePassword).en,
                        controller: _confirmController,
                        obscureText: true,
                        onSubmitted: (_) => _continue(),
                      ),
                      const SizedBox(height: 32),
                      FilledButton(
                        onPressed: _continue,
                        child: Bilingual.s(
                          () => S.continueLabel,
                          alignment: CrossAxisAlignment.center,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
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

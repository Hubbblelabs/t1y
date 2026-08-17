import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../widgets/auth_background.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/wave_header.dart';
import 'login_loading_screen.dart';

/// Returning-user branch: email is already known (and locked), just ask for
/// the password. The actual sign-in call happens on [LoginLoadingScreen],
/// reached once the password is submitted.
class LoginPasswordScreen extends StatefulWidget {
  final String email;
  const LoginPasswordScreen({super.key, required this.email});

  @override
  State<LoginPasswordScreen> createState() => _LoginPasswordScreenState();
}

class _LoginPasswordScreenState extends State<LoginPasswordScreen> {
  final _passwordController = TextEditingController();

  void _signIn() {
    FocusScope.of(context).unfocus();
    if (_passwordController.text.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LoginLoadingScreen(
          email: widget.email,
          password: _passwordController.text,
        ),
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
                const WaveHeader(title: 'Welcome Back', showBack: true),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.mail_outline,
                            size: 16,
                            color: AppTheme.deep.withValues(alpha: 0.75),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Email',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.deep.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 16,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.accent.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                widget.email,
                                style: const TextStyle(
                                  fontSize: 16,
                                  color: Colors.black,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const Icon(
                              Icons.check_circle,
                              size: 18,
                              color: AppTheme.primary,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      LabeledField(
                        icon: Icons.lock_outline,
                        label: 'Password',
                        hint: 'Enter your password',
                        controller: _passwordController,
                        obscureText: true,
                        autofocus: true,
                        onSubmitted: (_) => _signIn(),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed:
                              () {}, // Password reset isn't wired yet — see README known gaps.
                          child: Text(
                            'Forgot password?',
                            style: TextStyle(color: AppTheme.primary),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _signIn,
                        child: const Text('Log in'),
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

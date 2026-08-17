import 'package:flutter/material.dart';

import '../../services/auth_service.dart';
import '../../widgets/auth_background.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/wave_header.dart';
import 'login_password_screen.dart';
import 'signup_password_screen.dart';

/// The entry point after Get Started: prompts only email. Continuing checks
/// whether the address already has an account (see
/// AuthService.checkEmailExists's doc for why that's currently a mock) and
/// routes to the locked-email password screen for a returning user, or the
/// new-password + chat sign-up flow for a new one.
class EmailEntryScreen extends StatefulWidget {
  const EmailEntryScreen({super.key});

  @override
  State<EmailEntryScreen> createState() => _EmailEntryScreenState();
}

class _EmailEntryScreenState extends State<EmailEntryScreen> {
  final _emailController = TextEditingController();
  bool _checking = false;
  String? _error;

  Future<void> _continue() async {
    FocusScope.of(context).unfocus();
    final email = _emailController.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }

    setState(() {
      _checking = true;
      _error = null;
    });

    final exists = await AuthService.instance.checkEmailExists(email);
    if (!mounted) return;
    setState(() => _checking = false);

    if (exists) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LoginPasswordScreen(email: email)),
      );
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => SignupPasswordScreen(email: email)),
      );
    }
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
                const WaveHeader(
                  title: 'Welcome',
                  subtitle: 'Enter your email to sign in, or to get started.',
                  showBack: true,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        Text(
                          _error!,
                          style: const TextStyle(
                            color: Colors.red,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      LabeledField(
                        icon: Icons.mail_outline,
                        label: 'Email',
                        hint: 'Enter your email address',
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        autofocus: true,
                        onSubmitted: (_) => _continue(),
                      ),
                      const SizedBox(height: 32),
                      FilledButton(
                        onPressed: _checking ? null : _continue,
                        child: _checking
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Continue'),
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

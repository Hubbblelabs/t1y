import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import 'email_entry_screen.dart';

/// Honest completion state. Doesn't pretend the account is signed in —
/// the backend doesn't auto-sign-in after sign-up and defaults to requiring
/// email verification (see AuthService.signUp's doc), so this hands the
/// parent back to sign-in rather than a Home screen that would just fail.
class SignupCompleteScreen extends StatelessWidget {
  final String email;
  const SignupCompleteScreen({super.key, required this.email});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.lightest,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 84,
                  height: 84,
                  decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                  child: const Icon(Icons.check, color: Colors.white, size: 40),
                ),
                const SizedBox(height: 24),
                Text(
                  'Account created',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.deep),
                ),
                const SizedBox(height: 12),
                Text(
                  'We\'ve created an account for $email. Your study coordinator will confirm it '
                  'before you can sign in — check back shortly, or ask them directly.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, height: 1.5, color: AppTheme.deep.withValues(alpha: 0.75)),
                ),
                const SizedBox(height: 32),
                FilledButton(
                  onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const EmailEntryScreen()),
                    (route) => false,
                  ),
                  child: const Text('Back to sign in'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

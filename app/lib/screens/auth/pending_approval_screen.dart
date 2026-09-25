import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_background.dart';
import 'get_started_screen.dart';

/// Shown straight from the email-entry screen when the address belongs to a
/// PENDING account — asking for a password here would only end in the same
/// "email not verified" failure sign-in already produces, so this skips
/// straight to the honest explanation instead.
class PendingApprovalScreen extends StatelessWidget {
  const PendingApprovalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        body: AuthBackground(
          child: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                      child: const Icon(Icons.hourglass_top, size: 40, color: AppTheme.primary),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      S.pendingApprovalTitle,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: AppTheme.deep,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      S.pendingApprovalBody,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.deep.withValues(alpha: 0.75),
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 28),
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const GetStartedScreen()),
                        (route) => false,
                      ),
                      child: Text(S.backToStart),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

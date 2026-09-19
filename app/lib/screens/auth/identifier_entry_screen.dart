import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/auth_service.dart';
import '../../widgets/auth_background.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/wave_header.dart';
import 'household_login_screen.dart';
import 'pending_approval_screen.dart';
import 'signup_password_screen.dart';

/// The entry point after Get Started.
///
/// Accepts three things in one box — the parent's email, the parent's phone,
/// or one child's ID — because a family shouldn't have to know which kind of
/// credential the system wants. The backend classifies it (see
/// classifyIdentifier in api/lib/services/households.ts); the app only needs
/// to know whether it looks like an email, since that is the one case that
/// can also start a *new* sign-up.
class IdentifierEntryScreen extends StatefulWidget {
  const IdentifierEntryScreen({super.key});

  @override
  State<IdentifierEntryScreen> createState() => _IdentifierEntryScreenState();
}

class _IdentifierEntryScreenState extends State<IdentifierEntryScreen> {
  final _controller = TextEditingController();
  bool _checking = false;
  String? _error;

  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$');

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    FocusScope.of(context).unfocus();
    final identifier = _controller.text.trim();
    if (identifier.length < 3) {
      setState(() => _error = S.enterEmailPhoneOrId);
      return;
    }

    // A phone number or child ID always belongs to an existing enrolment —
    // only an email can begin a new sign-up, so only an email needs the
    // "does this account exist?" round trip.
    if (!identifier.contains('@')) {
      _goToPassword(identifier);
      return;
    }

    if (!_emailPattern.hasMatch(identifier)) {
      setState(() => _error = S.enterValidEmail);
      return;
    }

    setState(() {
      _checking = true;
      _error = null;
    });

    final result = await AuthService.instance.checkEmailExists(identifier);
    if (!mounted) return;
    setState(() => _checking = false);

    if (!result.exists) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => SignupPasswordScreen(email: identifier)),
      );
      return;
    }

    if (result.status == 'PENDING') {
      // Sign-in would only fail here (EMAIL_NOT_VERIFIED) — skip straight to
      // the honest explanation instead of asking for a password to reject.
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const PendingApprovalScreen()),
      );
      return;
    }

    _goToPassword(identifier);
  }

  void _goToPassword(String identifier) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => HouseholdLoginScreen(identifier: identifier)),
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
                  title: S.welcome,
                  subtitle: S.signInSubtitle,
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
                          style: const TextStyle(color: Colors.red, fontSize: 13),
                        ),
                        const SizedBox(height: 12),
                      ],
                      LabeledField(
                        icon: Icons.person_outline,
                        label: S.emailPhoneOrChildId,
                        hint: S.emailPhoneOrChildIdHint,
                        controller: _controller,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.username],
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
                            : Text(S.continueLabel),
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

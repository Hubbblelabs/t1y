import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/terms_content.dart';
import '../../theme/app_theme.dart';
import '../../providers/app_state.dart';
import '../../widgets/language_toggle.dart';

/// Full terms text behind the sign-up chat's "Read Terms & Conditions"
/// button. Tapping "I Agree" pops back with `true`, which
/// [SignupChatScreen._openTerms] treats as consent and continues sign-up.
///
/// Shown in the language the family picked at the start of sign-up, with an
/// English / Tamil switch in the header so either can be read before agreeing.
class TermsScreen extends StatefulWidget {
  const TermsScreen({super.key});

  @override
  State<TermsScreen> createState() => _TermsScreenState();
}

class _TermsScreenState extends State<TermsScreen> {
  bool _agreed = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          S.termsTitle,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: AppTheme.deep,
          ),
        ),
        actions: const [LanguageToggle(), SizedBox(width: 12)],
        toolbarHeight: 64,
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.deep,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AnimatedBuilder(
                      animation: AppState.instance,
                      builder: (context, _) => Text(
                        termsFullText.trim(),
                        style: const TextStyle(
                          color: AppTheme.ink,
                          fontSize: 14.5,
                          height: 1.6,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  InkWell(
                    onTap: () => setState(() => _agreed = !_agreed),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Checkbox(
                            value: _agreed,
                            activeColor: AppTheme.primary,
                            onChanged: (v) =>
                                setState(() => _agreed = v ?? false),
                          ),
                          Expanded(
                            child: Text(
                              S.agreeToTermsCheckbox,
                              style: const TextStyle(
                                fontSize: 13.5,
                                height: 1.4,
                                color: Colors.black,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: _agreed
                        ? () => Navigator.of(context).pop(true)
                        : null,
                    child: Text(
                      S.continueLabel,
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
    );
  }
}

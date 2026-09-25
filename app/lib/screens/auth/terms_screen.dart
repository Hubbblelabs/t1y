import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/terms_content.dart';
import '../../theme/app_theme.dart';
import '../../widgets/bilingual.dart';

/// Full terms text behind the sign-up chat's "Read Terms & Conditions"
/// button. Tapping "I Agree" pops back with `true`, which
/// [SignupChatScreen._openTerms] treats as consent and continues sign-up.
///
/// Shows the full English terms with the full Tamil translation beneath them,
/// in a smaller size, rather than behind a language switch. A parent cannot
/// meaningfully consent to terms they cannot read, so the Tamil is on the page
/// at the moment of consent — nothing has to be found or toggled first.
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
        title: Bilingual.s(
          () => S.termsTitle,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: AppTheme.deep,
          ),
        ),
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
                    Text(
                      termsFullTextEn.trim(),
                      style: const TextStyle(
                        color: Colors.black,
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 28),
                    const Divider(),
                    const SizedBox(height: 16),
                    // The same terms in Tamil, a step smaller so the English
                    // reads as the main text and this as its translation.
                    Text(
                      termsFullTextTa.trim(),
                      style: TextStyle(
                        color: Colors.black.withValues(alpha: 0.82),
                        fontSize: 12.5,
                        height: 1.6,
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
                            child: Bilingual.s(
                              () => S.agreeToTermsCheckbox,
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
    );
  }
}

import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/terms_content.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/language_toggle.dart';

/// Full terms text behind the sign-up chat's "Read Terms & Conditions"
/// button. Tapping "I Agree" pops back with `true`, which
/// [SignupChatScreen._openTerms] treats as consent and continues sign-up.
///
/// The language toggle matters here more than anywhere else in the app: a
/// parent cannot meaningfully consent to terms they cannot read, so the
/// Tamil version has to be reachable at the moment of consent rather than
/// only from Settings afterwards.
class TermsScreen extends StatefulWidget {
  const TermsScreen({super.key});

  @override
  State<TermsScreen> createState() => _TermsScreenState();
}

class _TermsScreenState extends State<TermsScreen> {
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: Text(S.termsTitle),
          backgroundColor: Colors.white,
          foregroundColor: AppTheme.deep,
          actions: const [LanguageToggle(), SizedBox(width: 8)],
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    child: Text(
                      termsFullText.trim(),
                      key: ValueKey(AppState.instance.locale),
                      style: const TextStyle(
                        color: Colors.black,
                        fontSize: 14,
                        height: 1.6,
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: Text(S.iAgree),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

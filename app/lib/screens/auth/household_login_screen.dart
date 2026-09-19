import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/api_client.dart';
import '../../services/household_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_background.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/wave_header.dart';
import 'child_select_screen.dart';
import 'login_loading_screen.dart';

/// Password step of the household sign-in.
///
/// Submitting proves the password and asks which children the identifier
/// covers. One child (or a child ID, which always names exactly one) signs
/// straight in; more than one goes to the picker.
///
/// The password is passed onward to the picker rather than exchanged for a
/// ticket, because selecting a child is a fresh, independently-authenticated
/// sign-in — see api/app/api/household/select/route.ts.
class HouseholdLoginScreen extends StatefulWidget {
  final String identifier;

  const HouseholdLoginScreen({super.key, required this.identifier});

  @override
  State<HouseholdLoginScreen> createState() => _HouseholdLoginScreenState();
}

class _HouseholdLoginScreenState extends State<HouseholdLoginScreen> {
  final _passwordController = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    FocusScope.of(context).unfocus();
    final password = _passwordController.text;
    if (password.isEmpty) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final lookup = await HouseholdService.instance.lookup(
        identifier: widget.identifier,
        password: password,
      );
      if (!mounted) return;

      if (lookup.children.length == 1) {
        // Nothing to choose between — go straight in. LoginLoadingScreen
        // handles the must-change-password branch and the pending-profile
        // flush, so single-child sign-in keeps using it rather than
        // duplicating that logic here.
        setState(() => _busy = false);
        final error = await Navigator.of(context).push<String>(
          MaterialPageRoute(
            builder: (_) => LoginLoadingScreen(
              identifier: widget.identifier,
              childId: lookup.children.first.childId,
              password: password,
            ),
          ),
        );
        if (!mounted) return;
        if (error != null) setState(() => _error = error);
        return;
      }

      setState(() => _busy = false);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ChildSelectScreen(
            identifier: widget.identifier,
            password: password,
            lookup: lookup,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = S.couldNotLoad;
      });
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
                WaveHeader(title: S.welcomeBack, showBack: true),
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
                            style: const TextStyle(color: Colors.red, fontSize: 13),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      Row(
                        children: [
                          Icon(
                            Icons.person_outline,
                            size: 16,
                            color: AppTheme.deep.withValues(alpha: 0.75),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              widget.identifier,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.deep.withValues(alpha: 0.75),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      LabeledField(
                        icon: Icons.lock_outline,
                        label: S.password,
                        hint: S.password,
                        controller: _passwordController,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        autofocus: true,
                        onSubmitted: (_) => _continue(),
                      ),
                      const SizedBox(height: 32),
                      FilledButton(
                        onPressed: _busy ? null : _continue,
                        child: _busy
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

import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/api_client.dart';
import '../../services/mpin_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/labeled_field.dart';
import '../../widgets/pin_field.dart';

/// Sets the parent PIN, or replaces a forgotten one.
///
/// Both fields are on one screen rather than a two-step "enter, now confirm"
/// sequence: with the digits visible, a parent can simply see that the two
/// match, and a wizard that hides what you typed is exactly what made
/// mismatches frustrating.
///
/// Replacing an existing PIN asks for the account password instead of the
/// old PIN — that is the point of "forgot": someone who remembered it
/// wouldn't be here.
class MpinScreen extends StatefulWidget {
  /// True when a PIN already exists, which turns this into the reset flow.
  final bool isReset;

  const MpinScreen({super.key, required this.isReset});

  @override
  State<MpinScreen> createState() => _MpinScreenState();
}

class _MpinScreenState extends State<MpinScreen> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final pin = _pinController.text.trim();

    if (pin.length < 4) {
      setState(() => _error = S.pinDigitsHint);
      return;
    }
    if (pin != _confirmController.text.trim()) {
      setState(() => _error = S.pinsDoNotMatch);
      return;
    }
    if (widget.isReset && _passwordController.text.isEmpty) {
      setState(() => _error = S.enterPasswordToReset);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      if (widget.isReset) {
        await MpinService.instance.reset(
          password: _passwordController.text,
          newPin: pin,
        );
      } else {
        await MpinService.instance.setPin(pin);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.isReset ? S.resetPin : S.setPin)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        children: [
          if (widget.isReset) ...[
            LabeledField(
              icon: Icons.lock_outline,
              label: S.currentPassword,
              hint: S.currentPassword,
              controller: _passwordController,
              obscureText: true,
            ),
            const SizedBox(height: 20),
          ],
          PinField(
            controller: _pinController,
            label: S.enterPin,
            enabled: !_saving,
            autofocus: !widget.isReset,
          ),
          const SizedBox(height: 16),
          PinField(
            controller: _confirmController,
            label: S.confirmPin,
            enabled: !_saving,
            onSubmitted: _save,
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            ErrorBanner(message: _error!),
          ],
          const SizedBox(height: 26),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.deep,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(S.save),
          ),
        ],
      ),
    );
  }
}

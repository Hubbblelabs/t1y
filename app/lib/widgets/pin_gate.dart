import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../screens/profile/mpin_screen.dart';
import '../services/api_client.dart';
import '../services/mpin_service.dart';
import '../theme/app_theme.dart';
import 'error_banner.dart';
import 'pin_field.dart';

/// Whether the parent has entered their PIN recently.
///
/// Kept in memory only, so closing the app, signing out, or ten minutes
/// without opening a health screen puts the lock back. A child picking up an
/// unlocked phone therefore has a short window at most.
class PinSession {
  PinSession._();

  static const idleLimit = Duration(minutes: 10);
  static DateTime? _lastUsed;

  static bool get isUnlocked {
    final last = _lastUsed;
    if (last == null) return false;
    if (DateTime.now().difference(last) > idleLimit) {
      _lastUsed = null;
      return false;
    }
    return true;
  }

  /// Opens the lock, or — while it is open — counts this as use.
  static void unlock() => _lastUsed = DateTime.now();

  static void lock() => _lastUsed = null;
}

/// Shows [child] only once the parent has entered their PIN.
///
/// Everything a family records about their child's health — glucose, insulin,
/// the calculators that read them — sits behind this one gate. A parent with
/// no PIN yet is asked to choose one right here: any four digits will do.
class PinGate extends StatefulWidget {
  final Widget child;

  /// Shown above the PIN box while the gate is closed.
  final String? title;

  /// Where "Back" goes when this gate is a tab rather than a pushed screen.
  final VoidCallback? onBack;

  const PinGate({super.key, required this.child, this.title, this.onBack});

  @override
  State<PinGate> createState() => _PinGateState();
}

class _PinGateState extends State<PinGate> {
  late Future<MpinStatus>? _status = PinSession.isUnlocked
      ? null
      : MpinService.instance.status();
  bool _unlocked = PinSession.isUnlocked;

  final _pin = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _pin.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool _canLeave(BuildContext context) =>
      Navigator.of(context).canPop() || widget.onBack != null;

  void _leave(BuildContext context) {
    FocusScope.of(context).unfocus();
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      widget.onBack?.call();
    }
  }

  void _open() {
    PinSession.unlock();
    setState(() => _unlocked = true);
  }

  void _reload() => setState(() {
    _status = MpinService.instance.status();
  });

  Future<void> _forgotPin() async {
    FocusScope.of(context).unfocus();
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const MpinScreen(isReset: true)),
    );
    if (changed == true) _open();
  }

  Future<void> _enter() async {
    final pin = _pin.text.trim();
    if (pin.length != 4 || _busy) {
      setState(() => _error = S.pinDigitsHint);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await MpinService.instance.verify(pin);
      if (!mounted) return;
      if (result.ok) return _open();
      _pin.clear();
      setState(() {
        _busy = false;
        _error = S.pinIncorrect;
      });
    } catch (e) {
      if (!mounted) return;
      _pin.clear();
      setState(() {
        _busy = false;
        _error = e is ApiException ? e.message : S.couldNotLoad;
      });
    }
  }

  Future<void> _create() async {
    final pin = _pin.text.trim();
    if (pin.length != 4) {
      setState(() => _error = S.pinDigitsHint);
      return;
    }
    if (pin != _confirm.text.trim()) {
      setState(() => _error = S.pinsDoNotMatch);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await MpinService.instance.setPin(pin);
      if (!mounted) return;
      _open();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e is ApiException ? e.message : S.couldNotLoad;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_unlocked) {
      // Any screen shown behind the gate keeps the window open while in use.
      PinSession.unlock();
      return widget.child;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        title: Text(widget.title ?? S.parentPin),
        leading: _canLeave(context)
            ? BackButton(onPressed: () => _leave(context))
            : null,
      ),
      body: FutureBuilder<MpinStatus>(
        future: _status,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            final e = snapshot.error;
            return _Centered(
              children: [
                ErrorBanner(
                  message: e is ApiException ? e.message : S.couldNotLoad,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                OutlinedButton(onPressed: _reload, child: Text(S.tryAgain)),
              ],
            );
          }

          final isSet = snapshot.data!.isSet;
          return _Centered(
            children: [
              Icon(
                Icons.lock_outline_rounded,
                size: 48,
                color: AppTheme.deep.withValues(alpha: 0.4),
              ),
              const SizedBox(height: 14),
              Text(
                isSet ? S.healthLockedTitle : S.pinNotSetTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.deep,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isSet ? S.healthLockedBody : S.pinNotSetBody,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13.5,
                  height: 1.45,
                  color: AppTheme.inkSoft,
                ),
              ),
              const SizedBox(height: 22),
              PinField(
                controller: _pin,
                label: isSet ? S.enterPin : S.setPin,
                enabled: !_busy,
                autofocus: true,
                obscure: true,
                onSubmitted: isSet ? _enter : null,
              ),
              if (isSet) ...[
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: _busy ? null : _forgotPin,
                    child: Text(S.forgotPin),
                  ),
                ),
              ],
              if (!isSet) ...[
                const SizedBox(height: 14),
                PinField(
                  controller: _confirm,
                  label: S.confirmPin,
                  enabled: !_busy,
                  obscure: true,
                  onSubmitted: _create,
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 14),
                ErrorBanner(message: _error!, textAlign: TextAlign.center),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _busy ? null : (isSet ? _enter : _create),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.deep,
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(isSet ? S.unlock : S.setPin),
                ),
              ),
              if (_canLeave(context)) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _busy ? null : () => _leave(context),
                  child: Text(S.notNow),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  final List<Widget> children;
  const _Centered({required this.children});

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
      child: Column(mainAxisSize: MainAxisSize.min, children: children),
    ),
  );
}

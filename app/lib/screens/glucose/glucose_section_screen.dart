import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/mpin_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/pin_field.dart';
import '../profile/profile_screen.dart';
import 'glucose_entry_screen.dart';

/// Reached by tapping "Glucose" on the Health hub — a real pushed screen
/// with its own back button, not a bottom-nav tab a parent could get stuck
/// on. Three states:
///
///   1. No PIN set yet — point at Profile, where it's set.
///   2. PIN set but not entered this session — the gate: just the PIN box
///      and an Unlock button, nothing else. No explanation is needed here
///      that isn't already obvious from having tapped "Glucose".
///   3. Unlocked — the entry form and reading history.
class GlucoseSectionScreen extends StatefulWidget {
  const GlucoseSectionScreen({super.key});

  @override
  State<GlucoseSectionScreen> createState() => _GlucoseSectionScreenState();
}

class _GlucoseSectionScreenState extends State<GlucoseSectionScreen> {
  late Future<MpinStatus> _statusFuture;
  bool _unlocked = false;

  @override
  void initState() {
    super.initState();
    _statusFuture = MpinService.instance.status();
  }

  void _reload() {
    setState(() => _statusFuture = MpinService.instance.status());
  }

  @override
  Widget build(BuildContext context) {
    if (_unlocked) return const GlucoseEntryScreen();

    return Scaffold(
      appBar: AppBar(title: Text(S.glucose)),
      body: FutureBuilder<MpinStatus>(
        future: _statusFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _Message(
              icon: Icons.cloud_off,
              title: S.couldNotLoad,
              body: '${snapshot.error}',
              actionLabel: S.tryAgain,
              onAction: _reload,
            );
          }

          final status = snapshot.data!;
          if (!status.isSet) {
            return _Message(
              icon: Icons.lock_person_outlined,
              title: S.pinNotSetTitle,
              body: S.pinNotSetBody,
              // Profile is reached from the header avatar on every screen,
              // so this points there rather than pushing a second route to
              // the same place.
              actionLabel: null,
              onAction: null,
            );
          }

          return _PinGate(
            initialStatus: status,
            onUnlocked: () => setState(() => _unlocked = true),
          );
        },
      ),
    );
  }
}

/// State 2, stripped to exactly two controls: the PIN box and Unlock.
class _PinGate extends StatefulWidget {
  final MpinStatus initialStatus;
  final VoidCallback onUnlocked;

  const _PinGate({required this.initialStatus, required this.onUnlocked});

  @override
  State<_PinGate> createState() => _PinGateState();
}

class _PinGateState extends State<_PinGate> {
  final _controller = TextEditingController();
  bool _checking = false;
  String? _error;
  late bool _locked = widget.initialStatus.isLocked;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final pin = _controller.text.trim();
    if (pin.length < 4 || _checking) return;

    setState(() {
      _checking = true;
      _error = null;
    });

    try {
      final result = await MpinService.instance.verify(pin);
      if (!mounted) return;
      if (result.ok) {
        widget.onUnlocked();
        return;
      }
      _controller.clear();
      setState(() {
        _checking = false;
        _locked = result.lockedUntil != null;
        _error = _locked ? S.pinLocked : S.pinAttemptsLeft(result.attemptsRemaining);
      });
    } catch (e) {
      if (!mounted) return;
      _controller.clear();
      setState(() {
        _checking = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            PinField(
              controller: _controller,
              label: S.enterPin,
              enabled: !_checking && !_locked,
              autofocus: true,
              obscure: true,
              onSubmitted: _submit,
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.red, fontSize: 12.5, height: 1.35),
                ),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: (_checking || _locked) ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.deep,
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: _checking
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(S.unlock),
              ),
            ),
            const SizedBox(height: 14),
            // The reset path lives in Profile, next to where the PIN was
            // set — kept small, since this only matters to someone stuck.
            TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              ),
              child: Text(
                S.forgotPinGoToProfile,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, color: Colors.black.withValues(alpha: 0.55)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _Message({
    required this.icon,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 54, color: AppTheme.deep.withValues(alpha: 0.35)),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppTheme.deep,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              body,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: Colors.black.withValues(alpha: 0.6),
              ),
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: 20),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

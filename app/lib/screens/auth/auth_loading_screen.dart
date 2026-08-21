import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_background.dart';

/// Shared full-screen loader for both sign-up and sign-in: runs [task],
/// cycling through [steps] every 3s while it's in flight, then hands off to
/// [onSuccess]. Surfaces a real error with a retry instead of spinning
/// forever if the network call fails or times out.
///
/// Light theme throughout — matches the rest of the auth flow rather than
/// standing out as a separate dark screen.
class AuthLoadingScreen extends StatefulWidget {
  final Future<void> Function() task;
  final WidgetBuilder onSuccess;
  final List<({String title, String subtitle})> steps;

  /// Replace the whole navigation stack rather than just this screen.
  ///
  /// Sign-in must do this: `pushReplacement` alone would swap the loader for
  /// Home but leave the email and password screens underneath, so the first
  /// back press from Home landed the user back on "enter your password"
  /// while already signed in.
  final bool clearStack;

  const AuthLoadingScreen({
    super.key,
    required this.task,
    required this.onSuccess,
    required this.steps,
    this.clearStack = false,
  });

  @override
  State<AuthLoadingScreen> createState() => _AuthLoadingScreenState();
}

class _AuthLoadingScreenState extends State<AuthLoadingScreen> {
  int _step = 0;
  Timer? _timer;
  String? _error;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) setState(() => _step = (_step + 1) % widget.steps.length);
    });
    _run();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _run() async {
    final started = DateTime.now();
    try {
      await widget.task();
      // Keep the loader up for at least one full message cycle so it never
      // just flashes past on a fast network.
      final elapsed = DateTime.now().difference(started);
      final remaining = const Duration(seconds: 3) - elapsed;
      if (remaining > Duration.zero) await Future.delayed(remaining);
      if (!mounted) return;
      final route = MaterialPageRoute(builder: widget.onSuccess);
      if (widget.clearStack) {
        Navigator.of(context).pushAndRemoveUntil(route, (_) => false);
      } else {
        Navigator.of(context).pushReplacement(route);
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Could not reach the server. Check your connection and try again.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = widget.steps[_step];
    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: _error != null ? _buildError() : _buildLoader(step),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoader(({String title, String subtitle}) step) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(
          width: 200,
          height: 200,
          child: CircularProgressIndicator(
            strokeWidth: 5,
            color: AppTheme.primary,
            backgroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 36),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 350),
          child: Column(
            key: ValueKey(_step),
            children: [
              Text(
                step.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppTheme.deep,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                step.subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppTheme.deep.withValues(alpha: 0.65),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildError() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.error_outline,
          color: AppTheme.deep.withValues(alpha: 0.7),
          size: 48,
        ),
        const SizedBox(height: 20),
        Text(
          _error!,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppTheme.deep.withValues(alpha: 0.85),
            fontSize: 15,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 24),
        OutlinedButton(
          onPressed: () {
            setState(() => _error = null);
            _run();
          },
          child: const Text('Try again'),
        ),
      ],
    );
  }
}

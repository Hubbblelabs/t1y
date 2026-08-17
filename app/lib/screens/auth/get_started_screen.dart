import 'dart:async';

import 'package:flutter/material.dart';

import '../../config/api_config.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_logo.dart';
import '../../widgets/orbiting_icons.dart';
import 'email_entry_screen.dart';

class GetStartedScreen extends StatelessWidget {
  const GetStartedScreen({super.key});

  Future<void> _editServerUrl(BuildContext context) async {
    final controller = TextEditingController(
      text: await ApiConfig.getBaseUrl(),
    );
    if (!context.mounted) return;
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Server address'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(
            hintText: 'http://192.168.x.x:3000',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(controller.text),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result != null && result.trim().isNotEmpty) {
      await ApiConfig.setBaseUrl(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppTheme.lightest, AppTheme.accent],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  onPressed: () => _editServerUrl(context),
                  icon: Icon(
                    Icons.settings_ethernet,
                    color: AppTheme.deep.withValues(alpha: 0.4),
                    size: 20,
                  ),
                  tooltip: 'Server address (dev only)',
                ),
              ),
              Expanded(
                child: Center(
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Two extra concentric rings, static, framing the
                      // orbiting one for depth without extra motion.
                      Container(
                        width: 390,
                        height: 390,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppTheme.primary.withValues(alpha: 0.10),
                            width: 1,
                          ),
                        ),
                      ),
                      Container(
                        width: 320,
                        height: 320,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: AppTheme.primary.withValues(alpha: 0.16),
                            width: 1,
                          ),
                        ),
                      ),
                      OrbitingIcons(
                        radius: 135,
                        ringColor: AppTheme.primary.withValues(alpha: 0.22),
                        badgeFill: Colors.white.withValues(alpha: 0.85),
                        badgeBorder: AppTheme.primary.withValues(alpha: 0.20),
                        iconColor: AppTheme.deep,
                        icons: const [
                          Icons.vaccines_outlined,
                          Icons.calendar_month_outlined,
                          Icons.school_outlined,
                          Icons.headphones_outlined,
                          Icons.favorite_border,
                          Icons.backpack_outlined,
                          Icons.location_on_outlined,
                        ],
                        center: Container(
                          width: 176,
                          height: 176,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.primary.withValues(alpha: 0.25),
                                blurRadius: 32,
                                spreadRadius: 4,
                              ),
                            ],
                          ),
                          child: const Center(child: AppLogo(size: 130)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(32, 0, 32, 40),
                child: Column(
                  children: [
                    Text(
                      'T1D Prajana Yandra',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.deep,
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 14),
                    const _BilingualTagline(),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppTheme.deep,
                          textStyle: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const EmailEntryScreen(),
                          ),
                        ),
                        child: const Text('Get Started'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shows the English tagline for 10s, then crossfades to the Tamil
/// translation for 10s, and repeats — so both languages get read without
/// the user having to do anything.
class _BilingualTagline extends StatefulWidget {
  const _BilingualTagline();

  @override
  State<_BilingualTagline> createState() => _BilingualTaglineState();
}

class _BilingualTaglineState extends State<_BilingualTagline> {
  static const _en =
      'For every brave little fighter and the family beside them';
  static const _ta =
      'ஒவ்வொரு குழந்தைக்கும், அவர்களுடன் துணை நிற்கும் குடும்பத்திற்கும்';

  bool _showEnglish = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) setState(() => _showEnglish = !_showEnglish);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 400),
      child: Text(
        _showEnglish ? _en : _ta,
        key: ValueKey(_showEnglish),
        textAlign: TextAlign.center,
        style: TextStyle(
          color: AppTheme.deep.withValues(alpha: 0.65),
          fontSize: 15,
          height: 1.4,
        ),
      ),
    );
  }
}

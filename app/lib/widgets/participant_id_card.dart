import 'package:flutter/material.dart';

import '../utils/tamil_name.dart';

import '../l10n/strings.dart';
import '../theme/app_theme.dart';
import 'app_logo.dart';

/// Full-height participant card — the identity face of the profile's flip
/// card. Shows everything captured during sign-up, following the supplied
/// ID-card reference: coloured panel with the avatar, a curved sweep into
/// white, and the identity block beneath.
class ParticipantIdCard extends StatelessWidget {
  final String name;
  final String? participantCode;
  final DateTime? dateOfBirth;
  final int? diagnosisYear;
  final String? sex;
  final String? email;

  /// Opens the Settings page (the gear in the card's corner).
  final VoidCallback onSettings;

  /// Signs out — on the card itself, where a parent looks for it.
  final VoidCallback onSignOut;

  const ParticipantIdCard({
    super.key,
    required this.name,
    required this.onSettings,
    required this.onSignOut,
    this.participantCode,
    this.dateOfBirth,
    this.diagnosisYear,
    this.sex,
    this.email,
  });

  int? get _age {
    if (dateOfBirth == null) return null;
    final now = DateTime.now();
    var age = now.year - dateOfBirth!.year;
    if (now.month < dateOfBirth!.month ||
        (now.month == dateOfBirth!.month && now.day < dateOfBirth!.day)) {
      age--;
    }
    return age;
  }

  @override
  Widget build(BuildContext context) {
    return _CardShell(
      child: Column(
        children: [
          SizedBox(
            height: 230,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppTheme.primary, AppTheme.deep],
                    ),
                  ),
                ),
                Positioned(
                  bottom: -1,
                  left: 0,
                  right: 0,
                  child: ClipPath(
                    clipper: _SweepClipper(),
                    child: Container(height: 66, color: Colors.white),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: _CornerButton(
                    icon: Icons.settings_outlined,
                    onTap: onSettings,
                  ),
                ),
                Align(
                  alignment: const Alignment(0, -0.30),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 96,
                        height: 96,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.18),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.55),
                            width: 2.5,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            _initials(name),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 34,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        name.isEmpty ? S.participant : localName(name),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          S.studyParticipant,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.primary,
                          ),
                        ),
                      ),
                      const AppLogo(size: 32),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Divider(
                    color: AppTheme.accent.withValues(alpha: 0.55),
                    height: 1,
                  ),
                  const SizedBox(height: 18),
                  Expanded(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (participantCode != null)
                            _Row(label: S.idNo, value: participantCode!),
                          if (_age != null)
                            _Row(label: S.age, value: S.years(_age!)),
                          if (dateOfBirth != null)
                            _Row(
                              label: S.dateOfBirth,
                              value: _formatDate(dateOfBirth!),
                            ),
                          if (sex != null && sex != 'UNSPECIFIED')
                            _Row(label: S.sex, value: _prettySex(sex!)),
                          if (diagnosisYear != null)
                            _Row(label: S.diagnosed, value: '$diagnosisYear'),
                          if (email != null)
                            _Row(label: S.account, value: email!),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: onSignOut,
                    icon: const Icon(
                      Icons.logout_rounded,
                      color: Color(0xFFC62828),
                      size: 19,
                    ),
                    label: Text(
                      S.signOut,
                      style: const TextStyle(
                        color: Color(0xFFC62828),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFFC62828)),
                      minimumSize: const Size.fromHeight(46),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  static String _formatDate(DateTime d) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }

  static String _prettySex(String value) => switch (value) {
    'FEMALE' => S.female,
    'MALE' => S.male,
    'PREFER_NOT_TO_SAY' => S.notStated,
    _ => value,
  };
}

/// Shared frame so both faces of the flip are the same size and elevation.
class _CardShell extends StatelessWidget {
  final Widget child;
  const _CardShell({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: AppTheme.deep.withValues(alpha: 0.16),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;

  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 116,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
                color: AppTheme.inkSoft,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.black,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Small circular flip control. Replaces the full-width banner that sat at
/// the bottom of the card — a corner affordance, as asked, so the identity
/// details keep the space.
class _CornerButton extends StatefulWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CornerButton({required this.icon, required this.onTap});

  @override
  State<_CornerButton> createState() => _CornerButtonState();
}

class _CornerButtonState extends State<_CornerButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    const fg = Colors.white;
    final bg = Colors.white.withValues(alpha: 0.22);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.88 : 1,
        duration: const Duration(milliseconds: 130),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: Icon(widget.icon, size: 20, color: fg),
        ),
      ),
    );
  }
}

class _SweepClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path()..moveTo(0, size.height);
    path.lineTo(0, size.height * 0.55);
    path.quadraticBezierTo(
      size.width * 0.5,
      -size.height * 0.35,
      size.width,
      size.height * 0.72,
    );
    path.lineTo(size.width, size.height);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

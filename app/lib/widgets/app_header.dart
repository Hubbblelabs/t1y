import 'package:flutter/material.dart';

import '../screens/profile/profile_screen.dart';
import 'language_toggle.dart';

/// `Page Title … [EN|தமிழ்] [👤]` — the language switcher sits immediately
/// left of the Profile button in every screen's header, never buried in
/// Settings (per the UX handoff §8–9). Language switching is instant: no
/// separate screen, no confirmation.
class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;

  const AppHeader({super.key, required this.title});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      actions: [
        const LanguageToggle(),
        const SizedBox(width: 6),
        IconButton(
          icon: const Icon(Icons.person_outline),
          tooltip: 'Profile',
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            );
          },
        ),
        const SizedBox(width: 4),
      ],
    );
  }
}

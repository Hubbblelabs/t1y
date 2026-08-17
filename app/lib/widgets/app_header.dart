import 'package:flutter/material.dart';

import '../providers/app_state.dart';
import '../services/content_service.dart';
import '../services/quiz_service.dart';
import '../screens/profile/profile_screen.dart';

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
        AnimatedBuilder(
          animation: AppState.instance,
          builder: (context, _) {
            final isTamil = AppState.instance.isTamil;
            return TextButton(
              onPressed: () async {
                await AppState.instance.setLocale(isTamil ? 'en' : 'ta');
                // Bust caches so the switch is visible immediately, not just
                // on next cold start.
                await ContentService.instance.getTopics(AppState.instance.locale, forceRefresh: true);
                await QuizService.instance.getQuizzes(AppState.instance.locale);
              },
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Text(
                  isTamil ? 'தமிழ்' : 'EN',
                  key: ValueKey(isTamil),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            );
          },
        ),
        IconButton(
          icon: const Icon(Icons.person_outline),
          tooltip: 'Profile',
          onPressed: () {
            Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
          },
        ),
        const SizedBox(width: 4),
      ],
    );
  }
}

import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/rewards/badges_screen.dart';
import '../services/app_tour.dart';
import '../services/diary_details.dart';
import 'language_toggle.dart';
import 'tour_step.dart';

/// `Page Title … [EN|தமிழ்] [👤]` — the language switcher sits immediately
/// left of the Profile button in every screen's header, never buried in
/// Settings (per the UX handoff §8–9). Language switching is instant: no
/// separate screen, no confirmation.
class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;

  /// Adds a trophy button opening the badge collection. On by default only
  /// where rewards are the point (Quizzes, Home) rather than on every screen
  /// — a header with four icons stops reading as a header.
  final bool showBadges;

  /// Marks the language switch and profile button as stops on the app tour.
  /// Only Home sets this — the tour runs from Home.
  final bool tour;

  const AppHeader({
    super.key,
    required this.title,
    this.showBadges = false,
    this.tour = false,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  Widget _maybeTour({
    required GlobalKey key,
    required String title,
    required String description,
    required Widget child,
    bool circle = false,
  }) => tour
      ? TourStep(
          tourKey: key,
          title: title,
          description: description,
          circle: circle,
          child: child,
        )
      : child;

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      actions: [
        if (showBadges)
          IconButton(
            icon: const Icon(Icons.workspace_premium_outlined),
            tooltip: S.myBadges,
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const BadgesScreen())),
          ),
        _maybeTour(
          key: AppTour.language,
          title: S.tourLanguageTitle,
          description: S.tourLanguageBody,
          child: const LanguageToggle(),
        ),
        const SizedBox(width: 6),
        _maybeTour(
          key: AppTour.profile,
          title: S.tourProfileTitle,
          description: S.tourProfileBody,
          circle: true,
          child: ValueListenableBuilder<bool>(
            valueListenable: DiaryDetails.attention,
            builder: (context, needsAttention, _) => Stack(
              clipBehavior: Clip.none,
              children: [
                IconButton(
                  icon: const Icon(Icons.person_outline),
                  tooltip: S.profile,
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ProfileScreen()),
                    );
                  },
                ),
                // A "!" on the corner while the child's details are incomplete.
                if (needsAttention)
                  Positioned(
                    top: 6,
                    right: 6,
                    child: IgnorePointer(
                      child: Container(
                        width: 16,
                        height: 16,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE53935),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.6),
                        ),
                        child: const Text(
                          '!',
                          style: TextStyle(
                            fontSize: 10,
                            height: 1,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 4),
      ],
    );
  }
}

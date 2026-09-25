import 'package:flutter/material.dart';
import 'package:showcaseview/showcaseview.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../services/app_tour.dart';
import '../../widgets/animated_nav_icon.dart';
import '../../widgets/tour_step.dart';
import '../health/health_hub_screen.dart';
import '../helpbook/helpbook_list_screen.dart';
import '../quizzes/quiz_list_screen.dart';
import 'home_tab.dart';

/// The 4-tab shell — Home, Help Book, Quizzes, Health. Profile is
/// deliberately not a bottom-nav tab (per the UX handoff §11); it's reached
/// via the icon in AppHeader on every screen.
///
/// Health replaces what used to be two separate tabs (Glucose, Calculations)
/// — merged into one hub screen, since both are occasional tools a parent
/// opens for a moment rather than something worth its own permanent tab.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  static const homeTabIndex = 0;
  static const helpBookTabIndex = 1;
  static const quizzesTabIndex = 2;
  static const healthTabIndex = 3;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = HomeShell.homeTabIndex;

  // Bumped every time Health is selected, as that tab's key — the screen
  // otherwise lives forever inside IndexedStack (never re-fetching), so a
  // reading recorded from Home, or a coordinator changing what this family is
  // enrolled for, would not show until the app restarted. A new key builds a
  // fresh screen that fetches again.
  int _healthRefreshTick = 0;

  @override
  void initState() {
    super.initState();
    AppState.instance.load();
    ShowcaseView.register(
      // A target that isn't on screen (glucose switched off for this family,
      // say) is skipped rather than stopping the tour.
      skipIfTargetNotPresent: true,
      blurValue: 1,
      onFinish: AppTour.markSeen,
      onDismiss: (_) => AppTour.markSeen(),
    );
    AppTour.requests.addListener(_startTour);
    // The first time a family reaches Home, the tour runs by itself.
    AppTour.seen().then((seen) {
      if (!seen && mounted) {
        Future.delayed(const Duration(milliseconds: 1200), _startTour);
      }
    });
  }

  @override
  void dispose() {
    AppTour.requests.removeListener(_startTour);
    ShowcaseView.get().unregister();
    super.dispose();
  }

  void _startTour() {
    if (!mounted) return;
    if (_index != HomeShell.homeTabIndex) _goTo(HomeShell.homeTabIndex);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ShowcaseView.get().startShowCase([
        AppTour.home,
        AppTour.readings,
        AppTour.language,
        AppTour.profile,
        AppTour.helpBookTab,
        AppTour.quizzesTab,
        AppTour.healthTab,
      ]);
    });
  }

  void _goTo(int index) {
    setState(() {
      _index = index;
      if (index == HomeShell.healthTabIndex) _healthRefreshTick++;
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeTab(onNavigateToTab: _goTo),
      const HelpBookListScreen(),
      const QuizListScreen(),
      HealthHubScreen(key: ValueKey(_healthRefreshTick)),
    ];

    return AnimatedBuilder(
      animation: AppState.instance,
      builder: (context, _) => Scaffold(
        body: IndexedStack(index: _index, children: screens),
        bottomNavigationBar: NavigationBar(
          height: 68,
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          selectedIndex: _index,
          onDestinationSelected: _goTo,
          destinations: [
            NavigationDestination(
              icon: AnimatedNavIcon(
                icon: Icons.home_outlined,
                activeIcon: Icons.home,
                isSelected: _index == HomeShell.homeTabIndex,
              ),
              label: S.home,
            ),
            NavigationDestination(
              icon: TourStep(
                tourKey: AppTour.helpBookTab,
                title: S.tourHelpBookTitle,
                description: S.tourHelpBookBody,
                circle: true,
                child: AnimatedNavIcon(
                  icon: Icons.auto_stories_outlined,
                  activeIcon: Icons.auto_stories_rounded,
                  isSelected: _index == HomeShell.helpBookTabIndex,
                ),
              ),
              label: S.helpBook,
            ),
            NavigationDestination(
              icon: TourStep(
                tourKey: AppTour.quizzesTab,
                title: S.tourQuizzesTitle,
                description: S.tourQuizzesBody,
                circle: true,
                child: AnimatedNavIcon(
                  icon: Icons.emoji_objects_outlined,
                  activeIcon: Icons.emoji_objects_rounded,
                  isSelected: _index == HomeShell.quizzesTabIndex,
                ),
              ),
              label: S.quizzes,
            ),
            NavigationDestination(
              icon: TourStep(
                tourKey: AppTour.healthTab,
                title: S.tourHealthTitle,
                description: S.tourHealthBody,
                circle: true,
                child: AnimatedNavIcon(
                  icon: Icons.monitor_heart_outlined,
                  activeIcon: Icons.monitor_heart_rounded,
                  isSelected: _index == HomeShell.healthTabIndex,
                ),
              ),
              label: S.health,
            ),
          ],
        ),
      ),
    );
  }
}

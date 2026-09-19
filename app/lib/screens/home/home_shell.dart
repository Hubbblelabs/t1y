import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../widgets/animated_nav_icon.dart';
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
  // otherwise lives forever inside IndexedStack (never rebuilt, never
  // re-fetching), so an admin unlocking IC/ISF, or a parent setting a PIN
  // in Profile, while the app is already open would never be reflected.
  // Changing its key forces Flutter to discard the old screen and build a
  // fresh one, which re-fetches both gates for real.
  int _healthRefreshTick = 0;

  @override
  void initState() {
    super.initState();
    AppState.instance.load();
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
              icon: AnimatedNavIcon(
                icon: Icons.auto_stories_outlined,
                activeIcon: Icons.auto_stories_rounded,
                isSelected: _index == HomeShell.helpBookTabIndex,
              ),
              label: S.helpBook,
            ),
            NavigationDestination(
              icon: AnimatedNavIcon(
                icon: Icons.emoji_objects_outlined,
                activeIcon: Icons.emoji_objects_rounded,
                isSelected: _index == HomeShell.quizzesTabIndex,
              ),
              label: S.quizzes,
            ),
            NavigationDestination(
              icon: AnimatedNavIcon(
                icon: Icons.monitor_heart_outlined,
                activeIcon: Icons.monitor_heart_rounded,
                isSelected: _index == HomeShell.healthTabIndex,
              ),
              label: S.health,
            ),
          ],
        ),
      ),
    );
  }
}

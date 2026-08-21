import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../widgets/animated_nav_icon.dart';
import '../calculations/calculations_list_screen.dart';
import '../helpbook/helpbook_list_screen.dart';
import '../quizzes/quiz_list_screen.dart';
import 'home_tab.dart';

/// The 4-tab shell — Home, Help Book, Calculations, Quizzes. Profile is
/// deliberately not a bottom-nav tab (per the UX handoff §11); it's reached
/// via the icon in AppHeader on every screen.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  static const homeTabIndex = 0;
  static const helpBookTabIndex = 1;
  static const calculationsTabIndex = 2;
  static const quizzesTabIndex = 3;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = HomeShell.homeTabIndex;

  @override
  void initState() {
    super.initState();
    AppState.instance.load();
  }

  void _goTo(int index) => setState(() => _index = index);

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeTab(onNavigateToTab: _goTo),
      const HelpBookListScreen(),
      const CalculationsListScreen(),
      const QuizListScreen(),
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
              icon: Icons.calculate_outlined,
              activeIcon: Icons.calculate_rounded,
              isSelected: _index == HomeShell.calculationsTabIndex,
            ),
            label: S.calculations,
          ),
          NavigationDestination(
            icon: AnimatedNavIcon(
              icon: Icons.emoji_objects_outlined,
              activeIcon: Icons.emoji_objects_rounded,
              isSelected: _index == HomeShell.quizzesTabIndex,
            ),
            label: S.quizzes,
          ),
        ],
      ),
      ),
    );
  }
}

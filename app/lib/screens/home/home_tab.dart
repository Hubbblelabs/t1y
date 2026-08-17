import 'package:flutter/material.dart';

import '../../widgets/app_header.dart';
import 'home_shell.dart';

/// Today's landing screen. Deliberately light — quick links into the other
/// three tabs, not a dense analytics dashboard (per the UX handoff §15).
class HomeTab extends StatelessWidget {
  final void Function(int tabIndex) onNavigateToTab;

  const HomeTab({super.key, required this.onNavigateToTab});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppHeader(title: 'T1D Prajana Yandra'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Welcome', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(
            'Learn, practise and track your diabetes care.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.3,
            children: [
              _QuickAction(
                icon: Icons.menu_book_outlined,
                label: 'Help Book',
                onTap: () => onNavigateToTab(HomeShell.helpBookTabIndex),
              ),
              _QuickAction(
                icon: Icons.calculate_outlined,
                label: 'Calculations',
                onTap: () => onNavigateToTab(HomeShell.calculationsTabIndex),
              ),
              _QuickAction(
                icon: Icons.quiz_outlined,
                label: 'Quizzes',
                onTap: () => onNavigateToTab(HomeShell.quizzesTabIndex),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 32, color: Theme.of(context).colorScheme.primary),
              const Spacer(),
              Text(label, style: Theme.of(context).textTheme.titleMedium),
            ],
          ),
        ),
      ),
    );
  }
}

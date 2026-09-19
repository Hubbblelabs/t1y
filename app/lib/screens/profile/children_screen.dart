import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/child.dart';
import '../../services/household_service.dart';
import '../../theme/app_theme.dart';
import '../auth/add_child_screen.dart';

/// The children enrolled under this parent, and the way to add another.
///
/// Each row shows the child's ID prominently, because that ID is also a
/// sign-in credential — a child can open their own record with it and skip
/// the picker entirely. That's the only place it's discoverable, so it is
/// shown as a value to copy rather than buried as metadata.
class ChildrenScreen extends StatefulWidget {
  const ChildrenScreen({super.key});

  @override
  State<ChildrenScreen> createState() => _ChildrenScreenState();
}

class _ChildrenScreenState extends State<ChildrenScreen> {
  late Future<List<Child>> _future;

  @override
  void initState() {
    super.initState();
    _future = HouseholdService.instance.siblings();
  }

  Future<void> _reload() async {
    setState(() => _future = HouseholdService.instance.siblings());
    await _future;
  }

  Future<void> _addChild() async {
    final childId = await Navigator.of(
      context,
    ).push<String>(MaterialPageRoute(builder: (_) => const AddChildScreen()));
    if (childId == null || !mounted) return;

    await _reload();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${S.childAdded} · $childId'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.lightest,
      appBar: AppBar(title: Text(S.yourChildren)),
      body: FutureBuilder<List<Child>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final children = snapshot.data ?? const <Child>[];

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                Text(
                  S.childIdHint,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.4,
                    color: Colors.black.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(height: 16),
                for (final child in children) _ChildRow(child: child),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _addChild,
                  icon: const Icon(Icons.person_add_alt_1_outlined, size: 18),
                  label: Text(S.addChild),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ChildRow extends StatelessWidget {
  final Child child;

  const _ChildRow({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: child.isCurrent
            ? Border.all(color: AppTheme.primary, width: 1.6)
            : Border.all(color: AppTheme.deep.withValues(alpha: 0.07)),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: child.isActive
                    ? const [AppTheme.primary, AppTheme.deep]
                    : const [Color(0xFFCFD8DC), Color(0xFF90A4AE)],
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              child.initials,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        child.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.deep,
                        ),
                      ),
                    ),
                    if (child.isCurrent) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          S.signedIn,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.primary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                // A stand-in id (profile not created yet) is deliberately not
                // shown: it can't be used to sign in, so presenting it as a
                // child ID would be a promise the app can't keep.
                if (child.hasParticipantCode)
                  Row(
                    children: [
                      Text(
                        '${S.childId}: ',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.black.withValues(alpha: 0.5),
                        ),
                      ),
                      SelectableText(
                        child.childId,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.deep,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                if (!child.isActive) ...[
                  const SizedBox(height: 5),
                  Text(
                    S.awaitingApproval,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFB26A00),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

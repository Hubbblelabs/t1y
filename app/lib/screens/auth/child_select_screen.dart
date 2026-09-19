import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/child.dart';
import '../../services/api_client.dart';
import '../../services/household_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_background.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/wave_header.dart';
import '../home/home_shell.dart';

/// Shown after a parent's password is accepted and their household holds more
/// than one child: pick whose record to open.
///
/// The identifier and password are carried through rather than a ticket, so
/// selecting a child is a full, independently-authenticated sign-in (see
/// api/app/api/household/select/route.ts). They live only in this widget's
/// memory and go away with the screen.
///
/// A child awaiting the coordinator's approval is listed but not selectable —
/// showing them greyed out with the reason is honest, where hiding them would
/// leave a parent wondering where the child they just added went.
class ChildSelectScreen extends StatefulWidget {
  final String identifier;
  final String password;
  final HouseholdLookup lookup;

  const ChildSelectScreen({
    super.key,
    required this.identifier,
    required this.password,
    required this.lookup,
  });

  @override
  State<ChildSelectScreen> createState() => _ChildSelectScreenState();
}

class _ChildSelectScreenState extends State<ChildSelectScreen> {
  late List<Child> _children = widget.lookup.children;
  String? _busyChildId;
  String? _error;

  Future<void> _open(Child child) async {
    if (!child.isActive || _busyChildId != null) return;
    setState(() {
      _busyChildId = child.childId;
      _error = null;
    });

    try {
      await HouseholdService.instance.selectChild(
        identifier: widget.identifier,
        password: widget.password,
        childId: child.childId,
      );
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeShell()),
        (route) => false,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busyChildId = null;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busyChildId = null;
        _error = S.couldNotLoad;
      });
    }
  }

  /// Adding a child needs a signed-in session, which doesn't exist yet at
  /// this point in the flow — so the parent signs in as an existing child
  /// first and adds from Profile. Explaining that is better than a button
  /// that fails.
  Future<void> _addChild() async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(S.addAnotherChild),
        content: Text(S.addChildFromProfile),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(S.close),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                WaveHeader(
                  title: S.whoIsLearning,
                  subtitle: widget.lookup.parentName,
                  showBack: true,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        ErrorBanner(message: _error!),
                        const SizedBox(height: 16),
                      ],
                      for (final child in _children)
                        _ChildCard(
                          child: child,
                          busy: _busyChildId == child.childId,
                          onTap: () => _open(child),
                        ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _busyChildId == null ? _addChild : null,
                        icon: const Icon(
                          Icons.person_add_alt_1_outlined,
                          size: 18,
                        ),
                        label: Text(S.addAnotherChild),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  final Child child;
  final bool busy;
  final VoidCallback onTap;

  const _ChildCard({
    required this.child,
    required this.busy,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final selectable = child.isActive;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppTheme.deep.withValues(alpha: 0.07),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: selectable && !busy ? onTap : null,
        child: Opacity(
          opacity: selectable ? 1 : 0.55,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: selectable
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
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        child.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.deep,
                        ),
                      ),
                      const SizedBox(height: 3),
                      // Only a real participant code is worth showing; the
                      // internal stand-in used for a profile-less account
                      // would just be noise.
                      Text(
                        [
                          if (child.hasParticipantCode) child.childId,
                          if (child.ageYears != null) '${child.ageYears} yrs',
                        ].join(' · '),
                        style: TextStyle(
                          fontSize: 12.5,
                          color: Colors.black.withValues(alpha: 0.55),
                        ),
                      ),
                      if (!selectable) ...[
                        const SizedBox(height: 6),
                        Text(
                          S.awaitingApprovalHint,
                          style: const TextStyle(
                            fontSize: 11.5,
                            height: 1.3,
                            color: Color(0xFFB26A00),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (busy)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else if (selectable)
                  const Icon(Icons.chevron_right, color: AppTheme.primary)
                else
                  const Icon(
                    Icons.hourglass_empty,
                    size: 18,
                    color: Color(0xFFB26A00),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

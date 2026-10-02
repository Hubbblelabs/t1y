import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../main.dart' show rootNavigatorKey;
import '../../services/guardian_share_service.dart';

/// Tells the parent, in the app, when a guardian has used their link — once
/// per link. Called when the app opens or resumes and when the Health tab is
/// refreshed.
Future<void> announceGuardianEntries() async {
  try {
    final service = GuardianShareService.instance;
    final unseen = await service.unseenUsed(await service.list());
    if (unseen.isEmpty) return;
    final context = rootNavigatorKey.currentContext;
    if (context == null || !context.mounted) return;
    // Marked first so a second call while the dialog is open cannot repeat it.
    await service.markSeen(unseen);
    for (final share in unseen) {
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          icon: const Icon(
            Icons.check_circle_rounded,
            color: Color(0xFF2E7D32),
          ),
          title: Text(S.guardianEnteredTitle),
          content: Text(S.guardianEnteredBody(share.guardianName ?? '—')),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(S.ok),
            ),
          ],
        ),
      );
    }
  } catch (_) {
    // A notice that cannot be shown must never get in the way of the app.
  }
}

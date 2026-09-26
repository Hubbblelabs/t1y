import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../services/connectivity_service.dart';
import '../theme/app_theme.dart';

/// Blocks an auth action with a dialog explaining that sign-in needs a
/// network, and returns once the device is back online.
///
/// Unlike the rest of the app — which reads from a local cache and just
/// flags itself as possibly stale via [OfflineBanner] — nothing about
/// signing in can work without reaching the server, so offline here gets a
/// dialog that says so plainly instead of a request that quietly times out.
/// Returns `true` if the caller should go ahead (the device was already
/// online, or came back online while the dialog was up), `false` if the
/// reader dismissed it while still offline.
Future<bool> ensureOnlineForAuth(BuildContext context) async {
  if (ConnectivityService.instance.isOnline) return true;

  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (context) => const _OfflineAuthDialog(),
  );
  return result ?? false;
}

class _OfflineAuthDialog extends StatelessWidget {
  const _OfflineAuthDialog();

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AnimatedBuilder(
        animation: ConnectivityService.instance,
        builder: (context, _) {
          // Closes itself the moment the network comes back — the reader
          // shouldn't have to notice and tap a button to be let back in.
          if (ConnectivityService.instance.isOnline) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop(true);
              }
            });
          }
          return AlertDialog(
            icon: const Icon(
              Icons.wifi_off_rounded,
              color: AppTheme.deep,
              size: 32,
            ),
            title: Text(
              S.offlineAuthTitle,
              textAlign: TextAlign.center,
            ),
            content: Text(
              S.offlineAuthBody,
              textAlign: TextAlign.center,
              style: TextStyle(height: 1.4, color: AppTheme.inkSoft),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: Text(S.notNow),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppTheme.deep),
                onPressed: ConnectivityService.instance.isOnline
                    ? () => Navigator.of(context).pop(true)
                    : null,
                child: Text(S.tryAgain),
              ),
            ],
          );
        },
      ),
    );
  }
}

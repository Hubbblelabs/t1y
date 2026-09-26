import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Whether the device currently has a network interface up (Wi-Fi or
/// mobile data) — not whether the internet is actually reachable, since
/// that would need its own outbound request. Good enough to tell "airplane
/// mode / no SIM / Wi-Fi off" from "connected", which is the case the rest
/// of the app needs to react to: showing old cached data as old, and
/// stopping the sign-in flow (which can never work offline) with a clear
/// message instead of a generic network-error banner.
class ConnectivityService extends ChangeNotifier {
  ConnectivityService._() {
    _sub = Connectivity().onConnectivityChanged.listen(_apply);
    Connectivity().checkConnectivity().then(_apply).catchError((_) {});
  }

  static final ConnectivityService instance = ConnectivityService._();

  late final StreamSubscription<List<ConnectivityResult>> _sub;
  bool _isOnline = true;

  bool get isOnline => _isOnline;

  void _apply(List<ConnectivityResult> results) {
    final online = results.any((r) => r != ConnectivityResult.none);
    if (online == _isOnline) return;
    _isOnline = online;
    notifyListeners();
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

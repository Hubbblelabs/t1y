import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../services/connectivity_service.dart';

/// A slim strip pinned to the very top of the app, over whatever screen is
/// showing, whenever the device has no network. Every screen already reads
/// from a local cache first, so nothing stops working while offline — this
/// just tells the reader that what they're looking at may not be current,
/// without blocking anything underneath it.
///
/// Dismissable with its own close button — tapping it collapses the strip
/// down to a small "no network" badge in the top-right corner instead of
/// hiding the state entirely, since the reader may still want to know they're
/// offline without the strip covering the screen the whole time. The badge
/// taps back open to the full strip. Coming back online clears the dismissal,
/// so the next time the connection actually drops the full strip shows again
/// rather than staying silently collapsed forever.
///
/// Lives above the app's Navigator (see the `builder` on `T1dpeApp`'s
/// `MaterialApp`), so it appears identically on every screen rather than
/// needing to be added to each one.
class OfflineBanner extends StatefulWidget {
  const OfflineBanner({super.key});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  bool _collapsed = false;
  bool _wasOffline = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: ConnectivityService.instance,
      builder: (context, _) {
        final offline = !ConnectivityService.instance.isOnline;
        if (offline && !_wasOffline) {
          // A fresh drop always starts as the full strip, even if a
          // previous one was dismissed.
          _collapsed = false;
        }
        _wasOffline = offline;

        return Stack(
          children: [
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: IgnorePointer(
                ignoring: !offline || _collapsed,
                child: AnimatedSlide(
                  offset: (offline && !_collapsed)
                      ? Offset.zero
                      : const Offset(0, -1),
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOut,
                  child: SafeArea(
                    bottom: false,
                    child: Material(
                      color: const Color(0xFFB3261E),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.cloud_off_rounded,
                              size: 15,
                              color: Colors.white,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                S.youAreOffline,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  height: 1.3,
                                ),
                              ),
                            ),
                            IconButton(
                              onPressed: () =>
                                  setState(() => _collapsed = true),
                              icon: const Icon(
                                Icons.close_rounded,
                                size: 18,
                                color: Colors.white,
                              ),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(
                                minWidth: 32,
                                minHeight: 32,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 0,
              right: 0,
              child: IgnorePointer(
                ignoring: !(offline && _collapsed),
                child: SafeArea(
                  bottom: false,
                  child: AnimatedOpacity(
                    opacity: (offline && _collapsed) ? 1 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8, right: 12),
                      child: _OfflineBadge(
                        onTap: () => setState(() => _collapsed = false),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _OfflineBadge extends StatelessWidget {
  final VoidCallback onTap;

  const _OfflineBadge({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFB3261E),
      shape: const CircleBorder(),
      elevation: 3,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: const Padding(
          padding: EdgeInsets.all(8),
          child: Icon(Icons.cloud_off_rounded, size: 16, color: Colors.white),
        ),
      ),
    );
  }
}

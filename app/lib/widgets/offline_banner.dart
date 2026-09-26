import 'package:flutter/material.dart';

import '../l10n/strings.dart';
import '../services/connectivity_service.dart';

/// A slim strip pinned to the very top of the app, over whatever screen is
/// showing, whenever the device has no network. Every screen already reads
/// from a local cache first, so nothing stops working while offline — this
/// just tells the reader that what they're looking at may not be current,
/// without blocking anything underneath it.
///
/// Lives above the app's Navigator (see the `builder` on `T1dpeApp`'s
/// `MaterialApp`), so it appears identically on every screen rather than
/// needing to be added to each one.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: ConnectivityService.instance,
      builder: (context, _) {
        final offline = !ConnectivityService.instance.isOnline;
        return Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: IgnorePointer(
            ignoring: !offline,
            child: AnimatedSlide(
              offset: offline ? Offset.zero : const Offset(0, -1),
              duration: const Duration(milliseconds: 260),
              curve: Curves.easeOut,
              child: SafeArea(
                bottom: false,
                child: Material(
                  color: const Color(0xFFB3261E),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 8,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.cloud_off_rounded,
                          size: 15,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 8),
                        Flexible(
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
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

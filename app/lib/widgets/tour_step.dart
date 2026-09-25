import 'package:flutter/material.dart';
import 'package:showcaseview/showcaseview.dart';

import '../l10n/strings.dart';
import '../theme/app_theme.dart';

/// One stop on the app tour: highlights [child] with a title, a line of
/// explanation and Back / Next / Skip — all in the app's current language.
///
/// The buttons are built each time rather than registered once, so switching
/// language mid-tour relabels them along with everything else.
class TourStep extends StatelessWidget {
  final GlobalKey tourKey;
  final String title;
  final String description;
  final Widget child;
  final bool circle;

  const TourStep({
    super.key,
    required this.tourKey,
    required this.title,
    required this.description,
    required this.child,
    this.circle = false,
  });

  @override
  Widget build(BuildContext context) {
    return Showcase(
      key: tourKey,
      title: title,
      description: description,
      titleTextStyle: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w800,
        color: AppTheme.deep,
      ),
      descTextStyle: const TextStyle(
        fontSize: 14,
        height: 1.4,
        color: AppTheme.ink,
      ),
      targetShapeBorder: circle
          ? const CircleBorder()
          : const RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(16)),
            ),
      tooltipBorderRadius: BorderRadius.circular(18),
      tooltipActionConfig: const TooltipActionConfig(
        alignment: MainAxisAlignment.spaceBetween,
        position: TooltipActionPosition.inside,
        gapBetweenContentAndAction: 12,
      ),
      tooltipActions: [
        TooltipActionButton(
          type: TooltipDefaultActionType.skip,
          name: S.tourSkip,
          backgroundColor: Colors.transparent,
          textStyle: const TextStyle(
            color: AppTheme.inkSoft,
            fontWeight: FontWeight.w700,
          ),
        ),
        TooltipActionButton(
          type: TooltipDefaultActionType.previous,
          name: S.tourBack,
          backgroundColor: AppTheme.lightest,
          textStyle: const TextStyle(
            color: AppTheme.deep,
            fontWeight: FontWeight.w700,
          ),
        ),
        TooltipActionButton(
          type: TooltipDefaultActionType.next,
          name: S.tourNext,
          backgroundColor: AppTheme.deep,
          textStyle: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
      child: child,
    );
  }
}

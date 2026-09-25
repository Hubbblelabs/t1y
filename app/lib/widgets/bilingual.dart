import 'package:flutter/material.dart';

import '../l10n/strings.dart';

/// English, with the Tamil translation beneath it in a smaller size.
///
/// Used on the sign-in and sign-up screens, which do not follow the language
/// switch: they always show both, so nobody has to find a toggle before they can
/// read what they are being asked. English is the main line; the Tamil is a
/// quieter line underneath.
class Bilingual extends StatelessWidget {
  final String en;
  final String ta;

  /// The English line. The Tamil takes this and scales it down.
  final TextStyle style;

  /// How large the Tamil is relative to the English.
  final double tamilScale;
  final TextAlign textAlign;
  final CrossAxisAlignment alignment;

  const Bilingual(
    this.en,
    this.ta, {
    super.key,
    this.style = const TextStyle(),
    this.tamilScale = 0.78,
    this.textAlign = TextAlign.start,
    this.alignment = CrossAxisAlignment.start,
  });

  /// From an existing `S` string, so the Tamil is not written out twice.
  factory Bilingual.s(
    String Function() read, {
    Key? key,
    TextStyle style = const TextStyle(),
    double tamilScale = 0.78,
    TextAlign textAlign = TextAlign.start,
    CrossAxisAlignment alignment = CrossAxisAlignment.start,
  }) {
    final both = S.both(read);
    return Bilingual(
      both.en,
      both.ta,
      key: key,
      style: style,
      tamilScale: tamilScale,
      textAlign: textAlign,
      alignment: alignment,
    );
  }

  @override
  Widget build(BuildContext context) {
    final base = style.fontSize ?? 14;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: alignment,
      children: [
        Text(en, style: style, textAlign: textAlign),
        if (ta.isNotEmpty && ta != en) ...[
          const SizedBox(height: 2),
          Text(
            ta,
            textAlign: textAlign,
            style: style.copyWith(
              fontSize: base * tamilScale,
              fontWeight: FontWeight.w500,
              color: (style.color ?? Colors.black).withValues(alpha: 0.78),
            ),
          ),
        ],
      ],
    );
  }
}

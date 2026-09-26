import 'package:flutter/material.dart';

import '../l10n/strings.dart';

/// A label on the screens before sign-in: shown in English.
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

  /// Before sign-in, labels and buttons are English only (the headings take
  /// turns with Tamil instead — see AlternatingText). The Tamil is kept here
  /// so a screen can go back to showing it without rewriting every call.
  @override
  Widget build(BuildContext context) =>
      Text(en, style: style, textAlign: textAlign);
}

/// Entering a number in a different unit from the one a formula expects.
///
/// A calculator declares the unit its formula is written in — glucose in mg/dL,
/// weight in kg. A parent may only have the other one to hand: a meter that
/// shows mmol/L, a scale in pounds. Rather than make them convert in their
/// head (and get a dose wrong by a factor of eighteen), the screen offers the
/// alternative unit and converts to the declared one before the formula runs.
///
/// This is deliberately a phone-side concern. The stored calculator names one
/// unit and never changes; how a person happens to enter a value is not part of
/// what was written down.
library;

/// One way of writing a quantity.
class UnitOption {
  /// What is shown to the parent ("mmol/L").
  final String label;

  /// How many of the *declared* unit one of these is. For mmol/L against a
  /// declared mg/dL that is 18.0182.
  final double toDeclared;

  const UnitOption(this.label, this.toDeclared);
}

/// Pairs the app knows how to convert, keyed by the declared unit.
///
/// Compared case-insensitively and ignoring spaces, so an admin writing "mg/dl"
/// or "mg/dL" gets the same offer.
const Map<String, List<UnitOption>> _alternatives = {
  'mg/dl': [UnitOption('mmol/L', 18.0182)],
  'mmol/l': [UnitOption('mg/dL', 1 / 18.0182)],
  'kg': [UnitOption('lb', 0.45359237)],
  'lb': [UnitOption('kg', 1 / 0.45359237)],
  'cm': [UnitOption('in', 2.54)],
  'in': [UnitOption('cm', 1 / 2.54)],
};

String _normal(String unit) => unit.replaceAll(' ', '').toLowerCase();

/// The other units a value declared in [declared] can be entered in. Empty for
/// a unit with no sensible alternative (units of insulin, grams of carbohydrate).
List<UnitOption> alternativesFor(String declared) =>
    _alternatives[_normal(declared)] ?? const [];

/// Converts [value], entered in [entered], to the [declared] unit.
///
/// Returns it unchanged when [entered] is the declared unit or is not one the
/// app knows — an unknown unit is never guessed at.
double toDeclaredUnit(double value, String entered, String declared) {
  if (_normal(entered) == _normal(declared)) return value;
  for (final option in alternativesFor(declared)) {
    if (_normal(option.label) == _normal(entered)) {
      return value * option.toDeclared;
    }
  }
  return value;
}

/// The reverse: a value in the declared unit, expressed in [target].
double fromDeclaredUnit(double value, String target, String declared) {
  if (_normal(target) == _normal(declared)) return value;
  for (final option in alternativesFor(declared)) {
    if (_normal(option.label) == _normal(target)) {
      return value / option.toDeclared;
    }
  }
  return value;
}

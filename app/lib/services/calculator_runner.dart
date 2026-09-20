import 'formula.dart';
import '../l10n/strings.dart';
import '../providers/app_state.dart';

/// Runs an admin-defined calculator on the phone.
///
/// The Dart twin of `runCalculator` in api/lib/services/calculators.ts. The
/// server validates a calculator when it is written and uses that function for
/// the admin's "try it" preview; this runs the same definition for a family,
/// offline. The two must agree — a number the dashboard refused must not be
/// accepted here, and vice versa.
///
/// The definition itself comes from `GET /api/calculators` and is never
/// computed server-side for a parent: the app is handed the formula and does
/// the arithmetic locally, so a calculator works in a kitchen with no signal.

/// One number a calculator asks for.
class CalculatorInput {
  final String key;

  /// English wording. Used in every error message so the app's wording matches
  /// the dashboard's exactly; what a parent *sees* on screen is [labelFor].
  final String label;
  final String? labelTa;
  final String unit;

  /// Set by the admin. A minimum of zero or below is the *only* way a
  /// calculator accepts a zero or negative value — see [runCalculator].
  final double? min;
  final double? max;
  final String? help;
  final String? helpTa;

  /// `ASK` — the parent types it. `DATA` — filled in from something already on
  /// file, named by [sourceKey], and still editable.
  final String source;
  final String? sourceKey;

  const CalculatorInput({
    required this.key,
    required this.label,
    required this.unit,
    this.labelTa,
    this.min,
    this.max,
    this.help,
    this.helpTa,
    this.source = 'ASK',
    this.sourceKey,
  });

  bool get isFromRecords => source == 'DATA' && sourceKey != null;

  String labelFor(String locale) =>
      locale == 'ta' && (labelTa?.trim().isNotEmpty ?? false)
      ? labelTa!
      : label;

  String? helpFor(String locale) =>
      locale == 'ta' && (helpTa?.trim().isNotEmpty ?? false) ? helpTa : help;

  factory CalculatorInput.fromJson(Map<String, dynamic> json) =>
      CalculatorInput(
        key: json['key'] as String,
        label: json['labelEn'] as String? ?? json['key'] as String,
        labelTa: json['labelTa'] as String?,
        unit: json['unit'] as String? ?? '',
        min: (json['min'] as num?)?.toDouble(),
        max: (json['max'] as num?)?.toDouble(),
        help: json['helpEn'] as String?,
        helpTa: json['helpTa'] as String?,
        source: json['source'] as String? ?? 'ASK',
        sourceKey: json['sourceKey'] as String?,
      );
}

/// One result a calculator works out.
class CalculatorOutput {
  final String key;
  final String label;
  final String? labelTa;
  final String unit;
  final int decimals;
  final String expression;

  const CalculatorOutput({
    required this.key,
    required this.label,
    required this.unit,
    required this.decimals,
    required this.expression,
    this.labelTa,
  });

  String labelFor(String locale) =>
      locale == 'ta' && (labelTa?.trim().isNotEmpty ?? false)
      ? labelTa!
      : label;

  factory CalculatorOutput.fromJson(Map<String, dynamic> json) =>
      CalculatorOutput(
        key: json['key'] as String,
        label: json['labelEn'] as String? ?? json['key'] as String,
        labelTa: json['labelTa'] as String?,
        unit: json['unit'] as String? ?? '',
        decimals: (json['decimals'] as num?)?.toInt() ?? 1,
        expression: json['expression'] as String? ?? '',
      );
}

/// A whole calculator as the dashboard defined it.
///
/// This is a *specification*, not a program: the numbers to collect and the
/// formulas that turn them into answers. The phone does the arithmetic — see
/// [runCalculator] — so it works with no connection.
class Calculator {
  final String key;
  final String nameEn;
  final String? nameTa;
  final String? descriptionEn;
  final String? descriptionTa;
  final String? noteEn;
  final String? noteTa;
  final List<CalculatorInput> inputs;
  final List<CalculatorOutput> outputs;

  const Calculator({
    required this.key,
    required this.nameEn,
    required this.inputs,
    required this.outputs,
    this.nameTa,
    this.descriptionEn,
    this.descriptionTa,
    this.noteEn,
    this.noteTa,
  });

  String name(String locale) =>
      locale == 'ta' && (nameTa?.trim().isNotEmpty ?? false) ? nameTa! : nameEn;

  String? description(String locale) =>
      locale == 'ta' && (descriptionTa?.trim().isNotEmpty ?? false)
      ? descriptionTa
      : descriptionEn;

  String? note(String locale) =>
      locale == 'ta' && (noteTa?.trim().isNotEmpty ?? false) ? noteTa : noteEn;

  /// The catalogue keys to ask the server to fill in.
  List<String> get dataKeys => [
    for (final input in inputs)
      if (input.isFromRecords) input.sourceKey!,
  ];

  factory Calculator.fromJson(Map<String, dynamic> json) => Calculator(
    key: json['key'] as String,
    nameEn: json['nameEn'] as String,
    nameTa: json['nameTa'] as String?,
    descriptionEn: json['descriptionEn'] as String?,
    descriptionTa: json['descriptionTa'] as String?,
    noteEn: json['noteEn'] as String?,
    noteTa: json['noteTa'] as String?,
    inputs: (json['inputs'] as List<dynamic>)
        .map((i) => CalculatorInput.fromJson(i as Map<String, dynamic>))
        .toList(),
    outputs: (json['outputs'] as List<dynamic>)
        .map((o) => CalculatorOutput.fromJson(o as Map<String, dynamic>))
        .toList(),
  );
}

/// One worked-out answer.
class CalculatorResult {
  final String key;
  final double value;

  const CalculatorResult(this.key, this.value);
}

/// What a calculator produced, or why it could not.
class CalculatorRun {
  final List<CalculatorResult> results;

  /// Written for a parent to read and act on, never a developer.
  final String? error;

  const CalculatorRun({required this.results, this.error});

  bool get ok => error == null;
}

/// Works out every answer in order, feeding each into the ones after it.
///
/// Returns a message instead of a number whenever the inputs cannot be
/// trusted. Nothing is ever guessed or defaulted: a value that is missing,
/// not a number, zero, negative, or outside the range the calculator allows
/// stops the whole run, because a half-right insulin dose is worse than none.
/// The name to put in a message: the parent's language when the dashboard has
/// given one, otherwise the English name.
String _label(CalculatorInput input) =>
    input.labelFor(AppState.instance.locale);

CalculatorRun runCalculator({
  required List<CalculatorInput> inputs,
  required List<CalculatorOutput> outputs,
  required Map<String, double?> values,
}) {
  final scope = <String, double>{};

  for (final input in inputs) {
    final value = values[input.key];

    if (value == null || !value.isFinite) {
      return CalculatorRun(
        results: const [],
        error: S.enterNumberFor(_label(input)),
      );
    }

    // Zero and negative numbers are refused unless the calculator explicitly
    // allows them. Every quantity these work on — a daily insulin dose, the
    // carbohydrates in a meal, a glucose reading — is positive in reality, so
    // a zero or a minus sign is a slip of the finger or a field nobody really
    // filled in. Letting one through would stop the sum dead on a zero
    // denominator, or produce a confidently wrong dose on a negative.
    //
    // Must stay identical to the rule in api/lib/services/calculators.ts.
    final allowsZeroOrLess = input.min != null && input.min! <= 0;
    if (!allowsZeroOrLess && value <= 0) {
      return CalculatorRun(
        results: const [],
        error: S.mustBeMoreThanZero(_label(input)),
      );
    }

    if (input.min != null && value < input.min!) {
      return CalculatorRun(
        results: const [],
        error: S.cannotBeLess(_label(input), _plain(input.min!)),
      );
    }
    if (input.max != null && value > input.max!) {
      return CalculatorRun(
        results: const [],
        error: S.cannotBeMore(_label(input), _plain(input.max!)),
      );
    }

    scope[input.key] = value;
  }

  final results = <CalculatorResult>[];
  for (final output in outputs) {
    try {
      final value = evaluateFormula(output.expression, scope);
      scope[output.key] = value;
      results.add(CalculatorResult(output.key, value));
    } on FormulaException catch (error) {
      // The formula's own wording is English; in Tamil say it plainly instead.
      return CalculatorRun(
        results: const [],
        error: S.isTamilNow ? S.calcCouldNotWork : error.message,
      );
    }
  }

  return CalculatorRun(results: results);
}

/// Whole numbers read better without a trailing ".0" in a message to a parent.
String _plain(double value) =>
    value == value.roundToDouble() ? value.toStringAsFixed(0) : '$value';

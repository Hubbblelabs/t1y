import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../services/calculator_runner.dart';
import '../../services/calculator_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/relative_time.dart';
import '../../utils/unit_conversion.dart';
import '../../widgets/calculator_disclaimer.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/locale_aware.dart';

/// One calculator, drawn entirely from its definition.
///
/// The boxes on this screen, their labels and units, the range each accepts and
/// the formulas behind the answers all arrive from the dashboard as data; the
/// screen only knows how to draw *a* calculator. Every answer is worked out
/// here on the phone by [runCalculator], so it works with no connection.
///
/// Where an input is marked as coming from the child's own records, it is
/// filled in — with when it was recorded, beside it — and stays editable. A
/// reading from three days ago is shown as three days old rather than passed
/// off as current, and a parent can always type over it.
class CalculatorScreen extends StatefulWidget {
  final Calculator calculator;

  const CalculatorScreen({super.key, required this.calculator});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen>
    with LocaleAware<CalculatorScreen> {
  bool _acknowledged = false;

  final Map<String, TextEditingController> _controllers = {};

  /// The unit each box is currently being entered in. Starts as the unit the
  /// formula is written in; a parent may switch to an alternative.
  final Map<String, String> _enteredIn = {};

  /// Boxes still showing a value taken from the child's records, and when that
  /// record was made. Removed the moment the parent edits the box.
  final Map<String, DateTime?> _fromRecords = {};

  /// Records-sourced boxes that had nothing to fill in.
  final Set<String> _nothingOnFile = {};

  String? _error;
  List<CalculatorResult>? _results;

  @override
  void initState() {
    super.initState();
    for (final input in widget.calculator.inputs) {
      _controllers[input.key] = TextEditingController();
      _enteredIn[input.key] = input.unit;
    }
    _fillFromRecords();
  }

  @override
  void onLocaleChanged(String locale) => setState(() {});

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _fillFromRecords() async {
    final wanted = widget.calculator.dataKeys;
    if (wanted.isEmpty) return;

    final recorded = await CalculatorService.instance.valuesFor(wanted);
    if (!mounted) return;

    setState(() {
      for (final input in widget.calculator.inputs) {
        if (!input.isFromRecords) continue;
        final found = recorded[input.sourceKey];
        final value = found?.value;

        if (value == null) {
          // No record: the parent types it. Never a zero, never a guess.
          _nothingOnFile.add(input.key);
          continue;
        }
        _controllers[input.key]!.text = _show(value, decimals: 1);
        _fromRecords[input.key] = found!.recordedAt;
      }
    });
  }

  /// A number as it should appear in a box: no trailing zeros.
  static String _show(double value, {int decimals = 2}) {
    final fixed = value.toStringAsFixed(decimals);
    if (!fixed.contains('.')) return fixed;
    return fixed
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }

  /// Switches the unit a box is entered in, converting what is already there so
  /// the same quantity is shown — 99 mg/dL becomes 5.5 mmol/L, not 99 mmol/L.
  void _changeUnit(CalculatorInput input, String unit) {
    final controller = _controllers[input.key]!;
    final current = double.tryParse(controller.text.replaceAll(',', '.'));
    final from = _enteredIn[input.key]!;

    setState(() {
      if (current != null) {
        final declared = toDeclaredUnit(current, from, input.unit);
        controller.text = _show(fromDeclaredUnit(declared, unit, input.unit));
      }
      _enteredIn[input.key] = unit;
      _results = null;
    });
  }

  void _calculate() {
    FocusScope.of(context).unfocus();

    final values = <String, double?>{};
    for (final input in widget.calculator.inputs) {
      final typed = double.tryParse(
        _controllers[input.key]!.text.trim().replaceAll(',', '.'),
      );
      // Converted to the unit the formula is written in *before* anything else
      // looks at it, including the range checks, which are in that unit too.
      values[input.key] = typed == null
          ? null
          : toDeclaredUnit(typed, _enteredIn[input.key]!, input.unit);
    }

    final run = runCalculator(
      inputs: widget.calculator.inputs,
      outputs: widget.calculator.outputs,
      values: values,
    );

    setState(() {
      _error = run.error;
      _results = run.ok ? run.results : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = AppState.instance.locale;
    final calculator = widget.calculator;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(title: Text(calculator.name(locale))),
      body: !_acknowledged
          ? CalculatorDisclaimer(
              calculatorName: calculator.name(locale),
              onAcknowledge: () => setState(() => _acknowledged = true),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                if (calculator.description(locale) != null) ...[
                  Text(
                    calculator.description(locale)!,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Colors.black.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                for (final input in calculator.inputs) ...[
                  _InputBox(
                    input: input,
                    locale: locale,
                    controller: _controllers[input.key]!,
                    enteredIn: _enteredIn[input.key]!,
                    recordedAt: _fromRecords.containsKey(input.key)
                        ? _fromRecords[input.key]
                        : null,
                    fromRecords: _fromRecords.containsKey(input.key),
                    nothingOnFile: _nothingOnFile.contains(input.key),
                    onEdited: () => setState(() {
                      // Once typed over, it is the parent's number, not the
                      // record's — and any earlier answer no longer matches.
                      _fromRecords.remove(input.key);
                      _nothingOnFile.remove(input.key);
                      _results = null;
                    }),
                    onUnit: (unit) => _changeUnit(input, unit),
                  ),
                  const SizedBox(height: 14),
                ],
                FilledButton(
                  onPressed: _calculate,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.deep,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(S.calculate),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  ErrorBanner(message: _error!),
                ],
                if (_results != null) ...[
                  const SizedBox(height: 18),
                  _ResultsCard(
                    calculator: calculator,
                    results: _results!,
                    locale: locale,
                  ),
                ],
              ],
            ),
    );
  }
}

class _InputBox extends StatelessWidget {
  final CalculatorInput input;
  final String locale;
  final TextEditingController controller;
  final String enteredIn;
  final DateTime? recordedAt;
  final bool fromRecords;
  final bool nothingOnFile;
  final VoidCallback onEdited;
  final ValueChanged<String> onUnit;

  const _InputBox({
    required this.input,
    required this.locale,
    required this.controller,
    required this.enteredIn,
    required this.recordedAt,
    required this.fromRecords,
    required this.nothingOnFile,
    required this.onEdited,
    required this.onUnit,
  });

  @override
  Widget build(BuildContext context) {
    final alternatives = alternativesFor(input.unit);
    final units = [input.unit, ...alternatives.map((a) => a.label)];
    final help = input.helpFor(locale);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          input.labelFor(locale),
          style: const TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: AppTheme.deep,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
          ],
          style: const TextStyle(color: Colors.black),
          onChanged: (_) => onEdited(),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            suffixText: enteredIn,
            border: _border(AppTheme.deep.withValues(alpha: 0.14)),
            enabledBorder: _border(AppTheme.deep.withValues(alpha: 0.14)),
            focusedBorder: _border(AppTheme.primary, width: 1.6),
          ),
        ),

        // Where the number came from — the thing that stops a stale reading
        // being mistaken for a current one.
        if (fromRecords && recordedAt != null)
          _caption(S.fromYourRecords(relativeTime(recordedAt!, locale: locale)))
        else if (fromRecords)
          _caption(S.fromYourRecords())
        else if (input.isFromRecords &&
            !nothingOnFile &&
            controller.text.isNotEmpty)
          _caption(S.enteredByYou),
        if (nothingOnFile) _caption(S.nothingOnFile, warn: true),

        if (units.length > 1) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                S.enterIn,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.black.withValues(alpha: 0.5),
                ),
              ),
              for (final unit in units)
                ChoiceChip(
                  label: Text(unit),
                  selected: unit == enteredIn,
                  onSelected: (_) => onUnit(unit),
                  showCheckmark: false,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: unit == enteredIn ? Colors.white : AppTheme.deep,
                  ),
                  selectedColor: AppTheme.primary,
                  backgroundColor: AppTheme.lightest,
                  side: BorderSide.none,
                ),
            ],
          ),
        ],

        if (help != null && help.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              help,
              style: TextStyle(
                fontSize: 12,
                height: 1.35,
                color: Colors.black.withValues(alpha: 0.55),
              ),
            ),
          ),
      ],
    );
  }

  Widget _caption(String text, {bool warn = false}) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: warn ? const Color(0xFFB26A00) : AppTheme.primary,
      ),
    ),
  );

  static OutlineInputBorder _border(Color color, {double width = 1}) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: color, width: width),
      );
}

class _ResultsCard extends StatelessWidget {
  final Calculator calculator;
  final List<CalculatorResult> results;
  final String locale;

  const _ResultsCard({
    required this.calculator,
    required this.results,
    required this.locale,
  });

  @override
  Widget build(BuildContext context) {
    final note = calculator.note(locale);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            S.yourResult,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: AppTheme.primary,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 10),
          for (final output in calculator.outputs)
            for (final result in results.where((r) => r.key == output.key))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      output.labelFor(locale),
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Colors.black.withValues(alpha: 0.6),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${result.value.toStringAsFixed(output.decimals)} ${output.unit}',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.deep,
                      ),
                    ),
                  ],
                ),
              ),
          if (note != null && note.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              note,
              style: TextStyle(
                fontSize: 12,
                height: 1.4,
                color: Colors.black.withValues(alpha: 0.6),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

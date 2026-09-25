import 'package:flutter/material.dart';

import '../../widgets/pin_gate.dart';
import 'package:flutter/services.dart';

import '../../l10n/strings.dart';
import '../../services/api_client.dart';
import '../../services/insulin_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/error_banner.dart';

/// Recording insulin doses, and seeing what was given recently.
///
/// It records what was given; it never suggests an amount. Those numbers feed
/// the calculators (a usual daily dose is what the 500 and 1800 rules start
/// from), which is why recording them consistently is worth a parent's time.
class InsulinScreen extends StatelessWidget {
  const InsulinScreen({super.key});

  @override
  Widget build(BuildContext context) => const PinGate(child: _InsulinBody());
}

class _InsulinBody extends StatefulWidget {
  const _InsulinBody();

  @override
  State<_InsulinBody> createState() => __InsulinBodyState();
}

const _kinds = [
  'RAPID_ACTING',
  'SHORT_ACTING',
  'INTERMEDIATE_ACTING',
  'LONG_ACTING',
  'PREMIXED',
  'OTHER',
];

String _kindLabel(String kind) => switch (kind) {
  'RAPID_ACTING' => S.rapidActing2,
  'SHORT_ACTING' => S.shortActing,
  'INTERMEDIATE_ACTING' => S.intermediateActing,
  'LONG_ACTING' => S.longActing,
  'PREMIXED' => S.premixed,
  _ => S.otherInsulin,
};

class __InsulinBodyState extends State<_InsulinBody> {
  final _name = TextEditingController();
  final _units = TextEditingController();

  String _kind = 'RAPID_ACTING';
  DateTime _when = DateTime.now();

  List<InsulinDose>? _doses;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _units.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final doses = await InsulinService.instance.recent();
      if (mounted) setState(() => _doses = doses);
    } catch (_) {
      // The list is a nicety; the form still works without it.
      if (mounted) setState(() => _doses = const []);
    }
  }

  Future<void> _pickWhen() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _when,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_when),
    );
    if (time == null) return;
    setState(() {
      _when = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();

    final name = _name.text.trim();
    final units = double.tryParse(_units.text.trim().replaceAll(',', '.'));

    if (name.isEmpty) {
      setState(() => _error = S.needInsulinName);
      return;
    }
    // The same limits the server applies: more than nothing, and no more than
    // a dose anyone could plausibly give.
    if (units == null || units <= 0 || units > 300) {
      setState(() => _error = S.badDose);
      return;
    }
    if (_when.isAfter(DateTime.now().add(const Duration(minutes: 5)))) {
      setState(() => _error = S.timeInFuture);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await InsulinService.instance.record(
        name: name,
        type: _kind,
        units: units,
        administeredAt: _when,
      );
      if (!mounted) return;
      _units.clear();
      setState(() {
        _saving = false;
        _when = DateTime.now();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(S.doseSaved),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final doses = _doses;
    final total = doses == null
        ? null
        : InsulinService.totalOn(DateTime.now(), doses);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(title: Text(S.insulin)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text(
            S.insulinRecordNote,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.4,
              color: Colors.black.withValues(alpha: 0.55),
            ),
          ),
          if (total != null && total > 0) ...[
            const SizedBox(height: 12),
            Text(
              S.todayTotal(
                total == total.roundToDouble()
                    ? total.toStringAsFixed(0)
                    : total.toStringAsFixed(1),
              ),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppTheme.deep,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.deep.withValues(alpha: 0.08)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_error != null) ...[
                  ErrorBanner(message: _error!),
                  const SizedBox(height: 12),
                ],
                Text(
                  S.insulinKind,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.deep,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final kind in _kinds)
                      ChoiceChip(
                        label: Text(_kindLabel(kind)),
                        selected: kind == _kind,
                        onSelected: (_) => setState(() => _kind = kind),
                        showCheckmark: false,
                        labelStyle: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: kind == _kind ? Colors.white : AppTheme.deep,
                        ),
                        selectedColor: AppTheme.primary,
                        backgroundColor: AppTheme.lightest,
                        side: BorderSide.none,
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                _field(_name, S.insulinName, TextInputType.text),
                const SizedBox(height: 12),
                _field(
                  _units,
                  S.doseUnits,
                  const TextInputType.numberWithOptions(decimal: true),
                  formatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                  ],
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _pickWhen,
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 16,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: AppTheme.deep.withValues(alpha: 0.14),
                      ),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.schedule,
                          size: 18,
                          color: AppTheme.deep,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${S.whenGiven}: ${_format(_when)}',
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppTheme.deep,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right,
                          color: AppTheme.primary,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.deep,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(S.save),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Text(
            S.recentDoses,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppTheme.deep,
            ),
          ),
          const SizedBox(height: 10),
          if (doses == null)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: CircularProgressIndicator(),
              ),
            )
          else if (doses.isEmpty)
            Text(
              S.noDosesYet,
              style: TextStyle(color: Colors.black.withValues(alpha: 0.5)),
            )
          else
            for (final dose in doses) _DoseRow(dose: dose),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    TextInputType type, {
    List<TextInputFormatter>? formatters,
  }) {
    return TextField(
      controller: controller,
      keyboardType: type,
      inputFormatters: formatters,
      style: const TextStyle(color: Colors.black),
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppTheme.deep.withValues(alpha: 0.14)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppTheme.deep.withValues(alpha: 0.14)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppTheme.primary, width: 1.6),
        ),
      ),
    );
  }

  static String _format(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}, '
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class _DoseRow extends StatelessWidget {
  final InsulinDose dose;
  const _DoseRow({required this.dose});

  @override
  Widget build(BuildContext context) {
    final units = dose.units == dose.units.roundToDouble()
        ? dose.units.toStringAsFixed(0)
        : dose.units.toStringAsFixed(1);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.deep.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dose.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.deep,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_kindLabel(dose.type)} · ${__InsulinBodyState._format(dose.administeredAt)}',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Colors.black.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
          Text(
            '$units ${S.unitsShort}',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppTheme.deep,
            ),
          ),
        ],
      ),
    );
  }
}

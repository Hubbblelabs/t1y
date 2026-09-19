import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/glucose_reading.dart';
import '../../services/api_client.dart';
import '../../services/glucose_service.dart';
import '../../services/profile_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/calculator_disclaimer.dart';
import '../../widgets/error_banner.dart';

enum _SortOrder { newestFirst, oldestFirst }

/// Glucose entry, shown once the parent PIN has been accepted — and, on top
/// of the number and the log, the two calculators that actually depend on a
/// reading: the Rule of 15 and the IC/ISF correction factor. Both used to be
/// separate screens where a parent had to type the same glucose value in
/// again; now they read straight off whichever reading is selected here, so
/// nothing is ever entered twice. To check a dose against an older reading
/// instead of the latest one, pick it from the log below — there is no
/// separate "which day" control, the log itself is that control.
///
/// No manual backdating for the entry itself — a parent reads the meter and
/// enters what it says, right now. A cooldown (admin-configurable; see the
/// backend's Settings → Glucose entry) keeps entry to an occasional,
/// deliberate action rather than something loggable at will — while that's
/// active the entry form is replaced by a plain "next reading at" notice,
/// never a form the parent can fill in only to have it rejected.
class GlucoseEntryScreen extends StatefulWidget {
  const GlucoseEntryScreen({super.key});

  @override
  State<GlucoseEntryScreen> createState() => _GlucoseEntryScreenState();
}

class _GlucoseEntryScreenState extends State<GlucoseEntryScreen> {
  final _valueController = TextEditingController();

  // Every calculator on this screen shows the same disclaimer any standalone
  // calculator screen would, before any of its content appears — this
  // screen is now calculator-adjacent from the moment it opens, not just
  // when a separate screen is pushed.
  bool _acknowledged = false;

  late Future<GlucoseEntryStatus> _statusFuture;
  late Future<List<GlucoseReading>> _historyFuture;

  bool _saving = false;
  String? _error;
  bool _featureDisabled = false;

  DateTime? _dateFilter;
  _SortOrder _sort = _SortOrder.newestFirst;

  /// The reading the Rule of 15 and IC/ISF sections are currently evaluated
  /// against — the just-saved reading by default, or whichever one the
  /// parent picked from the log below to check a different day.
  GlucoseReading? _selectedReading;

  // Per-child switch, defaulting to on for every child (see
  // Profile.icIsfUnlocked) — a coordinator can still turn it back off for
  // one child specifically, so this is still read per-child rather than
  // assumed true.
  bool _icIsfUnlocked = false;

  @override
  void initState() {
    super.initState();
    _statusFuture = GlucoseService.instance.status();
    _historyFuture = _loadHistory()..then(_onHistoryLoaded);
    ProfileService.instance.me(forceRefresh: true).then((me) {
      if (!mounted) return;
      final profile = me?['profile'] as Map<String, dynamic>?;
      setState(() => _icIsfUnlocked = profile?['icIsfUnlocked'] == true);
    });
  }

  void _onHistoryLoaded(List<GlucoseReading> readings) {
    if (!mounted || readings.isEmpty) return;
    // Default to whichever reading is newest — a parent who just opened the
    // screen to check a dose almost always means "against what I just read
    // off the meter", not a reading from days ago.
    final newest = _sort == _SortOrder.newestFirst
        ? readings.first
        : readings.last;
    setState(() => _selectedReading ??= newest);
  }

  void _selectReading(GlucoseReading reading) {
    setState(() => _selectedReading = reading);
  }

  @override
  void dispose() {
    _valueController.dispose();
    super.dispose();
  }

  Future<List<GlucoseReading>> _loadHistory() {
    return GlucoseService.instance.recent(
      newestFirst: _sort == _SortOrder.newestFirst,
      onDate: _dateFilter,
    );
  }

  void _refreshHistory() => setState(() => _historyFuture = _loadHistory());

  Future<void> _pickDateFilter() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateFilter ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => _dateFilter = picked);
    _refreshHistory();
  }

  void _clearDateFilter() {
    setState(() => _dateFilter = null);
    _refreshHistory();
  }

  void _setSort(_SortOrder order) {
    if (order == _sort) return;
    setState(() => _sort = order);
    _refreshHistory();
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final value = double.tryParse(_valueController.text.trim());
    if (value == null) {
      setState(() => _error = S.enterGlucoseValue);
      return;
    }
    // Matches the server's own physiological bounds for mg/dL (see
    // GLUCOSE_BOUNDS in api/lib/validation/health.ts) so an obvious typo is
    // caught before it becomes a round trip.
    if (value < 10 || value > 1000) {
      setState(() => _error = S.glucoseOutOfRange);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final saved = await GlucoseService.instance.create(value);
      if (!mounted) return;
      _valueController.clear();
      setState(() {
        _saving = false;
        _statusFuture = GlucoseService.instance.status();
        _historyFuture = _loadHistory();
        // The reading a parent just entered is the one they almost always
        // mean by "check this" — feeds the calculators below without them
        // having to go find it in the log.
        _selectedReading = saved;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(S.readingSaved),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _featureDisabled =
            e.code == 'FORBIDDEN' && e.message.contains('not enabled');
        _error = _featureDisabled ? S.glucoseDisabled : e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(S.glucoseEntry)),
      body: !_acknowledged
          ? CalculatorDisclaimer(
              calculatorName: S.glucoseCalculators,
              onAcknowledge: () => setState(() => _acknowledged = true),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              children: [
                FutureBuilder<GlucoseEntryStatus>(
                  future: _statusFuture,
                  builder: (context, snapshot) {
                    final status = snapshot.data;
                    if (status != null &&
                        !status.canEnterNow &&
                        status.nextAllowedAt != null) {
                      return _CooldownNotice(
                        nextAllowedAt: status.nextAllowedAt!,
                      );
                    }
                    return _EntryCard(
                      controller: _valueController,
                      saving: _saving,
                      error: _error,
                      onSave: _save,
                    );
                  },
                ),
                const SizedBox(height: 22),
                _RuleOf15Card(reading: _selectedReading),
                if (_icIsfUnlocked) ...[
                  const SizedBox(height: 16),
                  const _InsulinCalculatorCard(),
                ],
                const SizedBox(height: 10),
                Text(
                  S.glucoseTargetsNote,
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.4,
                    color: Colors.black.withValues(alpha: 0.5),
                  ),
                ),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Text(
                      S.recentReadings,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.deep,
                      ),
                    ),
                    const Spacer(),
                    _FilterSortBar(
                      dateFilter: _dateFilter,
                      sort: _sort,
                      onPickDate: _pickDateFilter,
                      onClearDate: _clearDateFilter,
                      onSetSort: _setSort,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  S.tapReadingToCheck,
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Colors.black.withValues(alpha: 0.45),
                  ),
                ),
                const SizedBox(height: 10),
                FutureBuilder<List<GlucoseReading>>(
                  future: _historyFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Padding(
                        padding: EdgeInsets.all(20),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    final readings = snapshot.data ?? const <GlucoseReading>[];
                    if (readings.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            _dateFilter != null
                                ? S.noReadingsForDate
                                : S.noReadingsYet,
                            style: TextStyle(
                              color: Colors.black.withValues(alpha: 0.5),
                            ),
                          ),
                        ),
                      );
                    }
                    return Column(
                      children: [
                        for (final r in readings)
                          _ReadingTile(
                            reading: r,
                            selected: r.id == _selectedReading?.id,
                            onTap: () => _selectReading(r),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  final TextEditingController controller;
  final bool saving;
  final String? error;
  final VoidCallback onSave;

  const _EntryCard({
    required this.controller,
    required this.saving,
    required this.error,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(18, 32, 18, 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: AppTheme.deep.withValues(alpha: 0.08),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                S.glucoseLevel,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.deep,
                ),
              ),
              const SizedBox(height: 6),
              // Centred and oversized on purpose: the number is the entire
              // task, and this is typed with a meter in the other hand.
              TextField(
                controller: controller,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                autofocus: true,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 56,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.deep,
                  height: 1.1,
                ),
                decoration: InputDecoration(
                  hintText: '—',
                  hintStyle: TextStyle(
                    fontSize: 56,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.deep.withValues(alpha: 0.2),
                  ),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                ErrorBanner(message: error!, textAlign: TextAlign.center),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: saving ? null : onSave,
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.deep,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(S.saveReading),
              ),
            ],
          ),
        ),
        // The unit, as a badge sitting in the card's corner rather than
        // plain text beside the number — the number is the only thing
        // meant to read as "the value"; mg/dL is context around it.
        Positioned(
          top: -12,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.primary,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: const Text(
              'mg/dL',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Shown in place of the entry form while the cooldown is active — never a
/// form that would only be rejected on save.
class _CooldownNotice extends StatelessWidget {
  final DateTime nextAllowedAt;

  const _CooldownNotice({required this.nextAllowedAt});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.deep.withValues(alpha: 0.08)),
      ),
      child: Column(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: AppTheme.lightest,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.schedule,
              color: AppTheme.primary,
              size: 26,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            S.nextReadingAt(_formatWhen(nextAllowedAt)),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppTheme.deep,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterSortBar extends StatelessWidget {
  final DateTime? dateFilter;
  final _SortOrder sort;
  final VoidCallback onPickDate;
  final VoidCallback onClearDate;
  final ValueChanged<_SortOrder> onSetSort;

  const _FilterSortBar({
    required this.dateFilter,
    required this.sort,
    required this.onPickDate,
    required this.onClearDate,
    required this.onSetSort,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          onTap: onPickDate,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: dateFilter != null
                  ? AppTheme.primary.withValues(alpha: 0.12)
                  : AppTheme.deep.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.event_outlined,
                  size: 14,
                  color: dateFilter != null
                      ? AppTheme.primary
                      : AppTheme.deep.withValues(alpha: 0.6),
                ),
                const SizedBox(width: 5),
                Text(
                  dateFilter != null ? _formatDate(dateFilter!) : S.filter,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: dateFilter != null
                        ? AppTheme.primary
                        : AppTheme.deep.withValues(alpha: 0.65),
                  ),
                ),
                if (dateFilter != null) ...[
                  const SizedBox(width: 3),
                  GestureDetector(
                    onTap: onClearDate,
                    child: Icon(Icons.close, size: 13, color: AppTheme.primary),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        PopupMenuButton<_SortOrder>(
          initialValue: sort,
          onSelected: onSetSort,
          itemBuilder: (context) => [
            PopupMenuItem(
              value: _SortOrder.newestFirst,
              child: Text(S.newestFirst),
            ),
            PopupMenuItem(
              value: _SortOrder.oldestFirst,
              child: Text(S.oldestFirst),
            ),
          ],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.deep.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.swap_vert,
                  size: 14,
                  color: AppTheme.deep.withValues(alpha: 0.6),
                ),
                const SizedBox(width: 5),
                Text(
                  S.sort,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.deep.withValues(alpha: 0.65),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ReadingTile extends StatelessWidget {
  final GlucoseReading reading;
  final bool selected;
  final VoidCallback onTap;

  const _ReadingTile({
    required this.reading,
    required this.selected,
    required this.onTap,
  });

  static const _bandColors = {
    GlucoseBand.low: Color(0xFFE53935),
    GlucoseBand.inRange: Color(0xFF2E7D32),
    GlucoseBand.high: Color(0xFFEF6C00),
  };

  String get _bandLabel => switch (reading.band) {
    GlucoseBand.low => S.low,
    GlucoseBand.inRange => S.inRange,
    GlucoseBand.high => S.high,
  };

  @override
  Widget build(BuildContext context) {
    final color = _bandColors[reading.band]!;
    final when = reading.measuredAt;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected
                  ? AppTheme.primary
                  : AppTheme.deep.withValues(alpha: 0.06),
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(width: 4, height: 38, color: color),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reading.value.toStringAsFixed(0),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: color,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    _bandLabel,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              if (selected)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Icon(
                    Icons.check_circle,
                    size: 16,
                    color: AppTheme.primary,
                  ),
                ),
              Text(
                '${when.day.toString().padLeft(2, '0')}-'
                '${when.month.toString().padLeft(2, '0')} · '
                '${when.hour.toString().padLeft(2, '0')}:'
                '${when.minute.toString().padLeft(2, '0')}',
                style: TextStyle(
                  fontSize: 11.5,
                  color: Colors.black.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Rule of 15 result, evaluated automatically against whichever reading is
/// selected above — from the source curriculum's hypoglycaemia article: "eat
/// 15-gram carbs, check blood sugar level in 15 minutes... roughly 4-5mg
/// glucose in the blood increases with one gram of carbs." 5 mg/dL per gram,
/// matching the article's own worked example (12g sugar to raise 60mg/dL).
/// No longer a separate screen a parent had to re-type the glucose value
/// into — the number is already right there.
class _RuleOf15Card extends StatelessWidget {
  final GlucoseReading? reading;

  const _RuleOf15Card({required this.reading});

  static const _mgPerGram = 5;
  static const _targetBg = 100;

  @override
  Widget build(BuildContext context) {
    final r = reading;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.deep.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.local_cafe_outlined,
                size: 18,
                color: AppTheme.primary,
              ),
              const SizedBox(width: 8),
              Text(
                S.ruleOf15,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.deep,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (r == null)
            Text(
              S.needAReadingFirst,
              style: TextStyle(
                fontSize: 12.5,
                color: Colors.black.withValues(alpha: 0.5),
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                _resultFor(r.value),
                style: const TextStyle(
                  fontSize: 13.5,
                  height: 1.4,
                  color: AppTheme.deep,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _resultFor(double value) {
    final bg = value.round();
    if (bg >= 70) return S.ruleOf15AboveRange(bg);
    final gramsNeeded = ((_targetBg - bg) / _mgPerGram).ceil();
    return S.ruleOf15Result(gramsNeeded, (gramsNeeded / 15).ceil());
  }
}

/// The IC/ISF section, restored to behave exactly like the original
/// standalone calculator did — the fields stay on screen and editable at
/// all times (no "Edit ratios" toggle to open first), and includes the
/// meal-dose step (carbs in a meal → bolus units) that step originally had.
/// Only difference from the original screen: it lives here, on the glucose
/// screen, instead of being its own destination — so a reading already
/// entered above doesn't need retyping into a second screen.
///
/// Both formulas are from the source curriculum's Nutrition and Insulin
/// Basics articles: IC ratio = 500/TDD, ISF = 1800/TDD for rapid-acting
/// insulin or 1500/TDD for short-acting (the 1980 Davidson formula), and
/// meal dose = carbs ÷ IC ratio.
class _InsulinCalculatorCard extends StatefulWidget {
  const _InsulinCalculatorCard();

  @override
  State<_InsulinCalculatorCard> createState() => _InsulinCalculatorCardState();
}

class _InsulinCalculatorCardState extends State<_InsulinCalculatorCard> {
  final _tddController = TextEditingController();
  bool _rapidActing = true;
  double? _icRatio;
  double? _isf;

  final _carbsController = TextEditingController();
  String? _mealDoseResult;

  @override
  void dispose() {
    _tddController.dispose();
    _carbsController.dispose();
    super.dispose();
  }

  void _calculateRatios() {
    final tdd = double.tryParse(_tddController.text);
    if (tdd == null || tdd <= 0) {
      setState(() {
        _icRatio = null;
        _isf = null;
      });
      return;
    }
    setState(() {
      _icRatio = 500 / tdd;
      _isf = (_rapidActing ? 1800 : 1500) / tdd;
    });
  }

  void _calculateMealDose() {
    final icRatio = _icRatio;
    if (icRatio == null) {
      setState(() => _mealDoseResult = S.computeRatiosFirst);
      return;
    }
    final carbs = double.tryParse(_carbsController.text);
    if (carbs == null || carbs <= 0) {
      setState(() => _mealDoseResult = S.enterCarbs);
      return;
    }
    final units = carbs / icRatio;
    setState(() {
      _mealDoseResult = S.mealDoseResult(
        units.toStringAsFixed(1),
        carbs.toStringAsFixed(0),
        icRatio.toStringAsFixed(0),
      );
    });
  }

  static InputDecoration _fieldDecoration(String label) => InputDecoration(
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
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppTheme.deep.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.calculate_outlined,
                size: 18,
                color: AppTheme.primary,
              ),
              const SizedBox(width: 8),
              Text(
                S.icIsf,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.deep,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tddController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(color: Colors.black),
            decoration: _fieldDecoration(S.totalDailyInsulinDose),
          ),
          const SizedBox(height: 10),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              S.rapidActingInsulin,
              style: const TextStyle(fontSize: 13.5),
            ),
            subtitle: Text(
              _rapidActing ? S.uses1800Rule : S.uses1500Rule,
              style: const TextStyle(fontSize: 12),
            ),
            value: _rapidActing,
            onChanged: (v) => setState(() => _rapidActing = v),
          ),
          const SizedBox(height: 6),
          FilledButton(onPressed: _calculateRatios, child: Text(S.calculate)),
          if (_icRatio != null && _isf != null) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                S.icIsfResult(
                  _icRatio!.toStringAsFixed(0),
                  _isf!.toStringAsFixed(0),
                ),
                style: const TextStyle(
                  fontSize: 13.5,
                  height: 1.4,
                  color: AppTheme.deep,
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              S.mealDoseTitle,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: AppTheme.deep,
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _carbsController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              style: const TextStyle(color: Colors.black),
              decoration: _fieldDecoration(S.carbsInMeal),
            ),
            const SizedBox(height: 10),
            FilledButton(
              onPressed: _calculateMealDose,
              child: Text(S.calculate),
            ),
            if (_mealDoseResult != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  _mealDoseResult!,
                  style: const TextStyle(
                    fontSize: 13.5,
                    height: 1.4,
                    color: AppTheme.deep,
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

String _formatDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}';

String _formatWhen(DateTime when) {
  final now = DateTime.now();
  final sameDay =
      when.year == now.year && when.month == now.month && when.day == now.day;
  final time =
      '${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}';
  if (sameDay) return 'today, $time';
  return '${_formatDate(when)}, $time';
}

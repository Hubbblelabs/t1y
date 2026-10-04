import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../l10n/strings.dart';
import '../../models/glucose_reading.dart';
import '../../models/health_config.dart';
import '../../providers/app_state.dart';
import '../../services/api_client.dart';
import '../../services/carb_service.dart';
import '../../services/exercise_service.dart';
import '../../services/glucose_service.dart';
import '../../services/health_access.dart';
import '../../services/insulin_service.dart';
import '../../services/local_reminders.dart';
import '../../theme/app_theme.dart';
import '../../utils/relative_time.dart';
import '../../widgets/app_loader.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/pin_gate.dart';

/// What a family can record.
enum RecordKind { glucose, insulin, carbs, exercise }

/// Recording glucose, insulin and carbohydrates — every one of them behind the
/// parent's PIN.
///
/// One screen with three simple forms rather than three separate tools: pick
/// what to record at the top, type the number, and say when (for insulin and
/// food — a glucose reading is always "now", read straight off the meter).
/// It records; it never works anything out or suggests an amount.
class RecordScreen extends StatelessWidget {
  final RecordKind initial;

  const RecordScreen({super.key, this.initial = RecordKind.glucose});

  @override
  Widget build(BuildContext context) => PinGate(
    title: S.recordTitle,
    child: _RecordBody(initial: initial),
  );
}

class _RecordBody extends StatefulWidget {
  final RecordKind initial;
  const _RecordBody({required this.initial});

  @override
  State<_RecordBody> createState() => _RecordBodyState();
}

class _RecordBodyState extends State<_RecordBody> {
  late RecordKind _kind = widget.initial;
  HealthAccess? _access;

  @override
  void initState() {
    super.initState();
    HealthAccess.load().then((access) {
      if (!mounted) return;
      setState(() {
        _access = access;
        final kinds = _kinds(access);
        if (kinds.isNotEmpty && !kinds.contains(_kind)) _kind = kinds.first;
      });
    });
  }

  static List<RecordKind> _kinds(HealthAccess access) => [
    if (access.glucose) RecordKind.glucose,
    if (access.insulin) RecordKind.insulin,
    if (access.carbs) RecordKind.carbs,
    if (access.exercise) RecordKind.exercise,
  ];

  @override
  Widget build(BuildContext context) {
    final access = _access;
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(title: Text(S.recordTitle)),
      body: access == null
          ? const Center(child: AppLoader())
          : !access.anything
          ? _Empty(message: S.glucoseDisabled)
          : Column(
              children: [
                if (_kinds(access).length > 1)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                    child: _KindPicker(
                      kinds: _kinds(access),
                      selected: _kind,
                      onSelect: (k) => setState(() => _kind = k),
                    ),
                  ),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    switchInCurve: Curves.easeOutCubic,
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween(
                          begin: const Offset(0, 0.03),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    ),
                    child: switch (_kind) {
                      RecordKind.glucose => _GlucoseForm(
                        key: const ValueKey('glucose'),
                        slots: access.config.glucoseSlots,
                      ),
                      RecordKind.insulin => const _InsulinForm(
                        key: ValueKey('insulin'),
                      ),
                      RecordKind.carbs => const _CarbForm(
                        key: ValueKey('carbs'),
                      ),
                      RecordKind.exercise => const _ExerciseForm(
                        key: ValueKey('exercise'),
                      ),
                    },
                  ),
                ),
              ],
            ),
    );
  }
}

class _KindPicker extends StatelessWidget {
  final List<RecordKind> kinds;
  final RecordKind selected;
  final ValueChanged<RecordKind> onSelect;

  const _KindPicker({
    required this.kinds,
    required this.selected,
    required this.onSelect,
  });

  static IconData icon(RecordKind kind) => switch (kind) {
    RecordKind.glucose => Icons.water_drop_outlined,
    RecordKind.insulin => Icons.vaccines_outlined,
    RecordKind.carbs => Icons.restaurant_outlined,
    RecordKind.exercise => Icons.directions_run_rounded,
  };

  static String label(RecordKind kind) => switch (kind) {
    RecordKind.glucose => S.glucose,
    RecordKind.insulin => S.insulin,
    RecordKind.carbs => S.carbs,
    RecordKind.exercise => S.exercise,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.fieldBorder),
      ),
      child: Row(
        children: [
          for (final kind in kinds)
            Expanded(
              child: GestureDetector(
                onTap: () => onSelect(kind),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: kind == selected
                        ? AppTheme.deep
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        icon(kind),
                        size: 20,
                        color: kind == selected
                            ? Colors.white
                            : AppTheme.inkSoft,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        label(kind),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: kind == selected
                              ? Colors.white
                              : AppTheme.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// What an entry form collects besides the number and the time.
class _Extras {
  final GlucoseSlot? slot;
  final String? text;
  const _Extras({this.slot, this.text});
}

/// One row in a recent-entries list.
class _Entry {
  final String value;
  final DateTime at;

  /// The guardian who entered it through a shared link, if it was not the parent.
  final String? by;
  const _Entry(this.value, this.at, {this.by});
}

String _plain(double v) =>
    v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);

String _formatWhen(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}, '
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

/// The shared shape of all three forms: a hint, one number, optionally when,
/// Save, then how long since the last entry and the last few entries.
class _EntryForm extends StatefulWidget {
  final String hint;
  final String fieldLabel;
  final IconData icon;
  final bool askWhen;
  final double min;
  final double max;
  final String rangeError;
  final Future<void> Function(double value, DateTime when, _Extras extras)
  onSave;
  final String savedMessage;
  final Future<List<_Entry>> Function() loadRecent;

  /// When set, the parent must say which of these glucose checks it is.
  final List<GlucoseSlot>? slots;

  /// When set, a free-text "what did they eat" field of at most this length.
  final int? foodMaxLength;

  /// Whole numbers only (exercise minutes).
  final bool wholeNumber;

  const _EntryForm({
    this.slots,
    this.foodMaxLength,
    this.wholeNumber = false,
    required this.hint,
    required this.fieldLabel,
    required this.icon,
    required this.askWhen,
    required this.min,
    required this.max,
    required this.rangeError,
    required this.onSave,
    required this.savedMessage,
    required this.loadRecent,
  });

  @override
  State<_EntryForm> createState() => _EntryFormState();
}

class _EntryFormState extends State<_EntryForm> {
  final _value = TextEditingController();
  final _food = TextEditingController();
  GlucoseSlot? _slot;
  DateTime? _when; // null means "now"
  bool _saving = false;
  String? _error;
  List<_Entry>? _recent;

  @override
  void initState() {
    super.initState();
    _loadRecent();
  }

  @override
  void dispose() {
    _value.dispose();
    _food.dispose();
    super.dispose();
  }

  Future<void> _loadRecent() async {
    try {
      final entries = await widget.loadRecent();
      if (mounted) setState(() => _recent = entries);
    } catch (_) {
      if (mounted) setState(() => _recent = const []);
    }
  }

  Future<void> _pickTime() async {
    final now = DateTime.now();
    final start = _when ?? now;
    final date = await showDatePicker(
      context: context,
      initialDate: start,
      firstDate: now.subtract(const Duration(days: 7)),
      lastDate: now,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(start),
    );
    if (time == null) return;
    final picked = DateTime(
      date.year,
      date.month,
      date.day,
      time.hour,
      time.minute,
    );
    setState(() {
      _when = picked.isAfter(now) ? now : picked;
    });
  }

  Future<bool> _confirmEntry(double value) async {
    final shown = widget.wholeNumber ? value.round().toString() : _plain(value);
    final food = _food.text.trim();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(S.checkEntryTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              S.checkEntryBody,
              style: const TextStyle(fontSize: 13.5, height: 1.4),
            ),
            const SizedBox(height: 14),
            if (_slot != null)
              Text(
                S.glucoseSlot(_slot!),
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.inkSoft,
                ),
              ),
            Text(
              '${widget.fieldLabel}: $shown',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppTheme.deep,
              ),
            ),
            if (food.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(food, style: const TextStyle(fontSize: 14)),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(S.goBackEdit),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(S.yesCorrectSave),
          ),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final value = double.tryParse(_value.text.trim().replaceAll(',', '.'));
    if (value == null || value < widget.min || value > widget.max) {
      setState(() => _error = widget.rangeError);
      return;
    }

    if (widget.slots != null && _slot == null) {
      setState(() => _error = S.chooseGlucoseSlot);
      return;
    }

    // Every number is double-checked before it is saved: these values feed
    // decisions about the child's care, so a slip of the finger is worth one
    // more tap.
    if (!await _confirmEntry(value)) return;
    if (!mounted) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(
        widget.wholeNumber ? value.roundToDouble() : value,
        _when ?? DateTime.now(),
        _Extras(slot: _slot, text: _food.text),
      );
      if (!mounted) return;
      _value.clear();
      _food.clear();
      setState(() {
        _saving = false;
        _when = null;
        _slot = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.savedMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
      _loadRecent();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = S.couldNotReach;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final recent = _recent;
    final locale = AppState.instance.locale;
    final last = (recent == null || recent.isEmpty) ? null : recent.first.at;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: AppTheme.deep.withValues(alpha: 0.06),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.hint,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.4,
                  color: AppTheme.inkSoft,
                ),
              ),
              const SizedBox(height: 16),
              if (_error != null) ...[
                ErrorBanner(message: _error!),
                const SizedBox(height: 12),
              ],
              if (widget.slots != null) ...[
                Text(
                  S.whichReading,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final slot in widget.slots!)
                      ChoiceChip(
                        label: Text(S.glucoseSlot(slot)),
                        selected: _slot == slot,
                        onSelected: (_) => setState(() => _slot = slot),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              TextField(
                controller: _value,
                keyboardType: TextInputType.numberWithOptions(
                  decimal: !widget.wholeNumber,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(
                    RegExp(widget.wholeNumber ? r'[0-9]' : r'[0-9.,]'),
                  ),
                ],
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.ink,
                ),
                decoration: InputDecoration(
                  labelText: widget.fieldLabel,
                  prefixIcon: Icon(widget.icon, color: AppTheme.primary),
                ),
                onSubmitted: (_) => _save(),
              ),
              if (widget.foodMaxLength != null) ...[
                const SizedBox(height: 14),
                TextField(
                  controller: _food,
                  maxLength: widget.foodMaxLength,
                  maxLines: 2,
                  minLines: 1,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    labelText: S.whatWasEaten,
                    hintText: S.whatWasEatenHint,
                    prefixIcon: const Icon(
                      Icons.edit_note_rounded,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
              ],
              if (widget.askWhen) ...[
                const SizedBox(height: 16),
                Text(
                  S.whenLabel,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _WhenChip(
                        label: S.nowLabel,
                        icon: Icons.bolt_rounded,
                        selected: _when == null,
                        onTap: () => setState(() => _when = null),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _WhenChip(
                        label: _when == null
                            ? S.chooseTime
                            : _formatWhen(_when!),
                        icon: Icons.schedule_rounded,
                        selected: _when != null,
                        onTap: _pickTime,
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 18),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.white,
                        ),
                      )
                    : Text(S.save),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        if (last != null)
          _SinceChip(text: S.lastEntryAgo(relativeTime(last, locale: locale))),
        const SizedBox(height: 14),
        Text(
          S.recentEntries,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppTheme.ink,
          ),
        ),
        const SizedBox(height: 8),
        if (recent == null)
          const Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: AppLoader(size: 32)),
          )
        else if (recent.isEmpty)
          Text(
            S.nothingRecorded,
            style: const TextStyle(fontSize: 13.5, color: AppTheme.inkSoft),
          )
        else
          for (final entry in recent.take(6))
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      relativeTime(entry.at, locale: locale),
                      style: const TextStyle(
                        fontSize: 13.5,
                        color: AppTheme.inkSoft,
                      ),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        entry.value,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.deep,
                        ),
                      ),
                      if (entry.by != null)
                        Text(
                          S.viaGuardian(entry.by!),
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppTheme.inkSoft,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

class _WhenChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _WhenChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppTheme.deep : Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? AppTheme.deep : AppTheme.fieldBorder,
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 18,
                color: selected ? Colors.white : AppTheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : AppTheme.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SinceChip extends StatelessWidget {
  final String text;
  const _SinceChip({required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.history_rounded, size: 18, color: AppTheme.deep),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: AppTheme.deep,
            ),
          ),
        ),
      ],
    );
  }
}

class _GlucoseForm extends StatelessWidget {
  final List<GlucoseSlot> slots;
  const _GlucoseForm({super.key, required this.slots});

  @override
  Widget build(BuildContext context) {
    return _EntryForm(
      slots: slots,
      hint: S.recordGlucoseHint,
      fieldLabel: S.glucoseReadingLabel,
      icon: Icons.water_drop_outlined,
      askWhen: false,
      // The server's own physiological bounds for mg/dL.
      min: 10,
      max: 1000,
      rangeError: S.glucoseOutOfRange,
      savedMessage: S.readingSaved,
      onSave: (value, _, extras) async {
        await GlucoseService.instance.create(value, slot: extras.slot);
        // The next reminder moves to six hours after this reading.
        await LocalReminders.scheduleAfter(DateTime.now());
      },
      loadRecent: () async {
        final readings = await GlucoseService.instance.recent(limit: 6);
        return [
          for (final GlucoseReading r in readings)
            _Entry('${_plain(r.value)} mg/dL', r.measuredAt, by: r.enteredBy),
        ];
      },
    );
  }
}

class _InsulinForm extends StatelessWidget {
  const _InsulinForm({super.key});

  @override
  Widget build(BuildContext context) {
    return _EntryForm(
      hint: S.recordInsulinHint,
      fieldLabel: S.unitsGiven,
      icon: Icons.vaccines_outlined,
      askWhen: true,
      min: 0.1,
      max: 300,
      rangeError: S.badDose,
      savedMessage: S.doseSaved,
      onSave: (value, when, _) =>
          InsulinService.instance.record(units: value, administeredAt: when),
      loadRecent: () async {
        final doses = await InsulinService.instance.recent(limit: 6);
        return [
          for (final d in doses)
            _Entry(
              S.unitsValue(_plain(d.units)),
              d.administeredAt,
              by: d.enteredBy,
            ),
        ];
      },
    );
  }
}

class _CarbForm extends StatelessWidget {
  const _CarbForm({super.key});

  @override
  Widget build(BuildContext context) {
    return _EntryForm(
      foodMaxLength: CarbService.maxFoodLength,
      hint: S.recordCarbsHint,
      fieldLabel: S.carbsEaten,
      icon: Icons.restaurant_outlined,
      askWhen: true,
      min: 0.1,
      max: 500,
      rangeError: S.badCarbs,
      savedMessage: S.carbsSaved,
      onSave: (value, when, extras) => CarbService.instance.record(
        carbsGrams: value,
        consumedAt: when,
        food: extras.text,
      ),
      loadRecent: () async {
        final entries = await CarbService.instance.recent(limit: 6);
        return [
          for (final e in entries)
            _Entry(
              S.gramsValue(_plain(e.carbsGrams ?? 0)),
              e.consumedAt,
              by: e.enteredBy,
            ),
        ];
      },
    );
  }
}

class _ExerciseForm extends StatelessWidget {
  const _ExerciseForm({super.key});

  @override
  Widget build(BuildContext context) {
    return _EntryForm(
      hint: S.recordExerciseHint,
      fieldLabel: S.exerciseMinutes,
      icon: Icons.directions_run_rounded,
      askWhen: true,
      wholeNumber: true,
      min: 1,
      max: 1440,
      rangeError: S.badExercise,
      savedMessage: S.exerciseSaved,
      onSave: (value, when, _) => ExerciseService.instance.record(
        minutes: value.round(),
        performedAt: when,
      ),
      loadRecent: () async {
        final entries = await ExerciseService.instance.recent(limit: 6);
        return [
          for (final e in entries)
            _Entry(
              S.minutesValue(e.durationMinutes),
              e.performedAt,
              by: e.enteredBy,
            ),
        ];
      },
    );
  }
}

class _Empty extends StatelessWidget {
  final String message;
  const _Empty({required this.message});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 14.5,
          height: 1.45,
          color: AppTheme.inkSoft,
        ),
      ),
    ),
  );
}

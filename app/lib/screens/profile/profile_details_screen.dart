import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/question.dart';
import '../../providers/app_state.dart';
import '../../services/api_client.dart';
import '../../services/profile_field_rules.dart';
import '../../services/profile_service.dart';
import '../../services/question_service.dart';
import '../../services/question_values.dart';
import '../../theme/app_theme.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/labeled_field.dart';

/// The child's details: read first, then Edit turns the same page into a form,
/// with Save and Cancel underneath.
///
/// One page instead of the old "View all details" and "Edit details" pair.
/// The questions are not written into this screen — they come from
/// [QuestionService], the list the dashboard controls, so a question added or
/// reworded there appears here without an app release. Each one is drawn by
/// its type and checked against its own rules before saving.
class ProfileDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> me;

  /// Opens straight into the form (from the "fill in your details" nudge).
  final bool startEditing;

  const ProfileDetailsScreen({
    super.key,
    required this.me,
    this.startEditing = false,
  });

  @override
  State<ProfileDetailsScreen> createState() => _ProfileDetailsScreenState();
}

class _ProfileDetailsScreenState extends State<ProfileDetailsScreen> {
  late Map<String, dynamic> _me = widget.me;
  List<Question>? _questions;
  late bool _editing = widget.startEditing;

  final Map<String, TextEditingController> _text = {};
  final Map<String, DateTime?> _dates = {};
  final Map<String, String?> _choices = {};

  bool _saving = false;
  String? _error;

  Map<String, dynamic> get _profile =>
      _me['profile'] as Map<String, dynamic>? ?? {};

  @override
  void initState() {
    super.initState();
    QuestionService.instance.profileQuestions().then((questions) {
      if (!mounted) return;
      setState(() => _questions = questions);
      _fillForm();
    });
  }

  @override
  void dispose() {
    for (final controller in _text.values) {
      controller.dispose();
    }
    super.dispose();
  }

  /// Puts the saved answers back into the form — on open, and on Cancel.
  void _fillForm() {
    final profile = _profile;
    for (final question in _questions ?? const <Question>[]) {
      final stored = answerFor(question, profile);
      switch (question.fieldType) {
        case 'DATE':
          _dates[question.key] = stored is String
              ? DateTime.tryParse(stored)
              : null;
        case 'CHOICE':
          final value = stored?.toString();
          // A stored value that is not one of today's options is left
          // unselected, not kept.
          _choices[question.key] = question.options.any((o) => o.value == value)
              ? value
              : null;
        default:
          final text = stored == null
              ? ''
              : (stored is num && stored == stored.roundToDouble()
                    ? stored.toStringAsFixed(0)
                    : stored.toString());
          (_text[question.key] ??= TextEditingController()).text = text;
      }
    }
  }

  void _cancel() {
    FocusScope.of(context).unfocus();
    _fillForm();
    setState(() {
      _editing = false;
      _error = null;
    });
  }

  /// Every answer as the raw string the checks and the payload builder read.
  Map<String, String> _rawAnswers() {
    final answers = <String, String>{};
    for (final question in _questions ?? const <Question>[]) {
      switch (question.fieldType) {
        case 'DATE':
          final date = _dates[question.key];
          if (date != null) {
            answers[question.key] = date.toIso8601String().split('T').first;
          }
        case 'CHOICE':
          final value = _choices[question.key];
          if (value != null) answers[question.key] = value;
        default:
          final text = _text[question.key]?.text.trim() ?? '';
          if (text.isNotEmpty) answers[question.key] = text;
      }
    }
    return answers;
  }

  /// The first thing wrong with the form, worded for a parent, or null.
  String? _firstProblem(Map<String, String> answers) {
    final locale = AppState.instance.locale;
    for (final question in _questions!) {
      final raw = answers[question.key];
      if (raw == null) {
        if (question.required) {
          return '${question.label(locale)} ${S.isRequired}';
        }
        continue;
      }
      if (question.fieldType == 'CHOICE') continue;
      final Object? typed = question.fieldType == 'NUMBER'
          ? num.tryParse(raw)
          : raw;
      final problem = checkAnswer(question, typed, answers: {...answers});
      if (problem != null) return problem;
    }
    return null;
  }

  Future<void> _pickDate(Question question) async {
    final now = DateTime.now();
    final years = (question.rules['maxAgeYears'] as num?)?.toInt() ?? 100;
    final allowFuture = question.rules['notInFuture'] != true;

    final picked = await showDatePicker(
      context: context,
      initialDate:
          _dates[question.key] ?? (years > 10 ? DateTime(now.year - 10) : now),
      firstDate: DateTime(now.year - years),
      lastDate: allowFuture ? DateTime(now.year + 5) : now,
      helpText: question.label(AppState.instance.locale),
    );
    if (picked != null) setState(() => _dates[question.key] = picked);
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final answers = _rawAnswers();
    final problem = _firstProblem(answers);
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ProfileService.instance.updateProfile(
        ProfileService.buildProfilePayload(
          answers,
          _questions!,
          // Editing, unlike signing up, must be able to *clear* an answer.
          sendBlanksAsNull: true,
        )..remove('diabetesType'),
      );
      final me = await ProfileService.instance.me(forceRefresh: true);
      if (!mounted) return;
      setState(() {
        if (me != null) _me = me;
        _saving = false;
        _editing = false;
      });
      _fillForm();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(S.detailsSaved),
          behavior: SnackBarBehavior.floating,
        ),
      );
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
    final questions = _questions;
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(_editing ? S.editDetails : S.details),
        backgroundColor: Colors.white,
      ),
      body: questions == null
          ? const Center(child: CircularProgressIndicator())
          : AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              child: _editing
                  ? _form(questions)
                  : _view(questions),
            ),
      bottomNavigationBar: questions == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: _editing
                    ? Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _saving ? null : _cancel,
                              child: Text(S.cancel),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton(
                              onPressed: _saving ? null : _save,
                              style: FilledButton.styleFrom(
                                minimumSize: const Size.fromHeight(52),
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
                      )
                    : FilledButton.icon(
                        onPressed: () => setState(() => _editing = true),
                        icon: const Icon(Icons.edit_outlined),
                        label: Text(S.editLabel),
                      ),
              ),
            ),
    );
  }

  Widget _view(List<Question> questions) {
    final profile = _profile;
    final locale = AppState.instance.locale;
    final dob = DateTime.tryParse(profile['dateOfBirth'] as String? ?? '');
    final heightCm = (profile['heightCm'] as num?)?.toDouble();
    final weightKg = (profile['baselineWeightKg'] as num?)?.toDouble();
    final bmi = (heightCm != null && weightKg != null && heightCm > 0)
        ? weightKg / ((heightCm / 100) * (heightCm / 100))
        : null;

    final bySection = <String, List<Question>>{};
    for (final question in questions) {
      bySection.putIfAbsent(question.section, () => []).add(question);
    }

    return ListView(
      key: const ValueKey('view'),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        _ViewSection(
          title: S.account,
          rows: [
            (S.idNo, profile['participantCode'] as String?),
            (S.account, _me['email'] as String?),
          ],
        ),
        for (final entry in bySection.entries)
          _ViewSection(
            title: sectionTitle(entry.key),
            rows: [
              for (final question in entry.value) ...[
                (
                  question.label(locale),
                  displayFor(question, answerFor(question, profile), locale),
                ),
                // Worked out rather than stored, so shown beside the answers
                // they come from.
                if (question.key == 'dateOfBirth' && dob != null)
                  (S.age, S.years(ageInYears(dob))),
                if (question.key == 'baselineWeightKg' && bmi != null)
                  (S.bmi, bmi.toStringAsFixed(1)),
              ],
            ],
          ),
      ],
    );
  }

  Widget _form(List<Question> questions) {
    final bySection = <String, List<Question>>{};
    for (final question in questions) {
      bySection.putIfAbsent(question.section, () => []).add(question);
    }

    final children = <Widget>[
      if (_error != null) ...[
        ErrorBanner(message: _error!),
        const SizedBox(height: 16),
      ],
    ];
    var first = true;
    for (final entry in bySection.entries) {
      if (!first) children.add(const SizedBox(height: 24));
      first = false;
      children
        ..add(_SectionLabel(sectionTitle(entry.key)))
        ..add(const SizedBox(height: 10));
      for (var i = 0; i < entry.value.length; i++) {
        if (i > 0) children.add(const SizedBox(height: 14));
        children.add(_field(entry.value[i]));
      }
    }

    return ListView(
      key: const ValueKey('form'),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: children,
    );
  }

  Widget _field(Question question) {
    final locale = AppState.instance.locale;
    final base = question.label(locale);
    final withUnit = question.unit == null ? base : '$base (${question.unit})';
    final label = question.required ? '$withUnit *' : withUnit;
    final icon = _iconFor(question);

    switch (question.fieldType) {
      case 'DATE':
        final date = _dates[question.key];
        return _TapField(
          icon: icon,
          label: label,
          value: date == null ? null : formatDate(date),
          onTap: () => _pickDate(question),
        );
      case 'CHOICE':
        return _ChoiceField(
          icon: icon,
          label: label,
          value: _choices[question.key],
          options: question.options,
          locale: locale,
          onChanged: (v) => setState(() => _choices[question.key] = v),
        );
      case 'NUMBER':
        return LabeledField(
          icon: icon,
          label: label,
          hint: question.hint(locale) ?? withUnit,
          controller: _text[question.key] ??= TextEditingController(),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          whiteFill: true,
        );
      default:
        return LabeledField(
          icon: icon,
          label: label,
          hint: question.hint(locale) ?? base,
          controller: _text[question.key] ??= TextEditingController(),
          keyboardType: question.key.toLowerCase().contains('phone')
              ? TextInputType.phone
              : TextInputType.text,
          whiteFill: true,
        );
    }
  }

  /// Familiar icons for the questions the app has always had; a sensible one
  /// by type for anything added since.
  static IconData _iconFor(Question question) => switch (question.key) {
    'name' => Icons.person_outline,
    'dateOfBirth' => Icons.cake_outlined,
    'sex' => Icons.wc_outlined,
    'diagnosisYear' => Icons.event_note_outlined,
    'phone' || 'emergencyContactPhone' => Icons.call_outlined,
    'city' => Icons.location_city_outlined,
    'country' => Icons.public_outlined,
    'treatmentModality' => Icons.medical_services_outlined,
    'heightCm' => Icons.height_outlined,
    'baselineWeightKg' => Icons.monitor_weight_outlined,
    'primaryClinician' => Icons.local_hospital_outlined,
    'emergencyContactName' => Icons.contact_emergency_outlined,
    _ => switch (question.fieldType) {
      'DATE' => Icons.event_outlined,
      'CHOICE' => Icons.list_alt_outlined,
      'NUMBER' => Icons.pin_outlined,
      _ => Icons.edit_note_outlined,
    },
  };
}

class _ViewSection extends StatelessWidget {
  final String title;
  final List<(String, String?)> rows;

  const _ViewSection({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: AppTheme.primary,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 6),
          for (final (label, value) in rows) ...[
            _DetailRow(label: label, value: value),
            const Divider(height: 1, color: Color(0xFFE5EAF1)),
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String? value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final filled = value != null && value!.trim().isNotEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: AppTheme.inkSoft),
            ),
          ),
          Expanded(
            child: Text(
              filled ? value! : S.notProvided,
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: filled ? FontWeight.w600 : FontWeight.w500,
                fontStyle: filled ? FontStyle.normal : FontStyle.italic,
                color: filled ? AppTheme.ink : AppTheme.inkSoft,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w700,
      color: AppTheme.deep,
      letterSpacing: 0.2,
    ),
  );
}

/// A field whose value is picked, not typed — matches [LabeledField]'s look so
/// the form reads as one consistent set of rows.
class _TapField extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;

  const _TapField({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.deep.withValues(alpha: 0.14)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: AppTheme.deep),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                value ?? label,
                style: TextStyle(
                  fontSize: 14.5,
                  color: value == null
                      ? AppTheme.inkSoft
                      : AppTheme.deep,
                ),
              ),
            ),
            const Icon(Icons.chevron_right, color: AppTheme.primary),
          ],
        ),
      ),
    );
  }
}

/// A row of choice chips — cheaper to scan than a dropdown for the handful of
/// options every choice question here has.
class _ChoiceField extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? value;
  final List<QuestionOption> options;
  final String locale;
  final ValueChanged<String> onChanged;

  const _ChoiceField({
    required this.icon,
    required this.label,
    required this.value,
    required this.options,
    required this.locale,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: AppTheme.deep.withValues(alpha: 0.7)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.inkSoft,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((option) {
            final selected = option.value == value;
            return ChoiceChip(
              label: Text(option.label(locale)),
              selected: selected,
              onSelected: (_) => onChanged(option.value),
              labelStyle: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : AppTheme.deep,
              ),
              selectedColor: AppTheme.primary,
              backgroundColor: AppTheme.lightest,
              showCheckmark: false,
              side: BorderSide.none,
            );
          }).toList(),
        ),
      ],
    );
  }
}

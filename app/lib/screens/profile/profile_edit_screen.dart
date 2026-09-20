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

/// A plain, full-page form — deliberately not the card the profile screen
/// otherwise uses. The ID card stays a compact identity face; editing the
/// fuller set of details needs room a small flip-card was never meant to hold.
///
/// The questions are not written into this screen. They come from
/// [QuestionService], which is the list the dashboard controls, so a question
/// added or reworded there appears here without an app release. Each one is
/// drawn according to its type and checked against its own rules before saving.
class ProfileEditScreen extends StatefulWidget {
  final Map<String, dynamic> initial;

  const ProfileEditScreen({super.key, required this.initial});

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  /// Null only while the list is being read — normally from the phone's own
  /// copy, so this is not perceptible.
  List<Question>? _questions;

  final Map<String, TextEditingController> _text = {};
  final Map<String, DateTime?> _dates = {};
  final Map<String, String?> _choices = {};

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final questions = await QuestionService.instance.profileQuestions();
    if (!mounted) return;

    for (final question in questions) {
      final stored = answerFor(question, widget.initial);
      switch (question.fieldType) {
        case 'DATE':
          _dates[question.key] = stored is String
              ? DateTime.tryParse(stored)
              : null;
        case 'CHOICE':
          final value = stored?.toString();
          // A stored value that is not one of today's options (an old record
          // that says "prefer not to say") is left unselected, not kept.
          _choices[question.key] = question.options.any((o) => o.value == value)
              ? value
              : null;
        default:
          _text[question.key] = TextEditingController(
            text: stored == null
                ? ''
                : (stored is num && stored == stored.roundToDouble()
                      ? stored.toStringAsFixed(0)
                      : stored.toString()),
          );
      }
    }
    setState(() => _questions = questions);
  }

  @override
  void dispose() {
    for (final controller in _text.values) {
      controller.dispose();
    }
    super.dispose();
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

      final Object? typed = question.fieldType == 'NUMBER'
          ? num.tryParse(raw)
          : raw;
      if (question.fieldType == 'CHOICE') continue;

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
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
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
    final questions = _questions;
    return Scaffold(
      appBar: AppBar(title: Text(S.editDetails)),
      body: questions == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              children: [
                if (_error != null) ...[
                  ErrorBanner(message: _error!),
                  const SizedBox(height: 16),
                ],
                ..._sections(questions),
                const SizedBox(height: 28),
                FilledButton(
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
              ],
            ),
    );
  }

  /// The questions grouped under their section headings, in the order the
  /// dashboard set.
  List<Widget> _sections(List<Question> questions) {
    final bySection = <String, List<Question>>{};
    for (final question in questions) {
      bySection.putIfAbsent(question.section, () => []).add(question);
    }

    final widgets = <Widget>[];
    var first = true;
    for (final entry in bySection.entries) {
      if (!first) widgets.add(const SizedBox(height: 24));
      first = false;
      widgets
        ..add(_SectionLabel(sectionTitle(entry.key)))
        ..add(const SizedBox(height: 10));
      for (var i = 0; i < entry.value.length; i++) {
        if (i > 0) widgets.add(const SizedBox(height: 14));
        widgets.add(_field(entry.value[i]));
      }
    }
    return widgets;
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
          controller: _text[question.key]!,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          whiteFill: true,
        );

      default:
        return LabeledField(
          icon: icon,
          label: label,
          hint: question.hint(locale) ?? base,
          controller: _text[question.key]!,
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
                      ? Colors.black.withValues(alpha: 0.5)
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
                  color: Colors.black.withValues(alpha: 0.6),
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

import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/profile_field.dart';
import '../../providers/app_state.dart';
import '../../services/api_client.dart';
import '../../services/profile_fields_service.dart';
import '../../services/profile_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/labeled_field.dart';

/// A plain, full-page form — deliberately not the card the profile screen
/// otherwise uses. The ID card stays a compact identity face; editing the
/// fuller set of details (contact, treatment, emergency contact) needs room
/// a small flip-card was never meant to hold, and mixing an edit form into
/// that card's own layout was what made it feel cramped in the first place.
class ProfileEditScreen extends StatefulWidget {
  final Map<String, dynamic> initial;

  const ProfileEditScreen({super.key, required this.initial});

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

const _treatmentOptions = [
  ('LIFESTYLE_ONLY', 'lifestyleOnly'),
  ('ORAL_MEDICATION', 'oralMedication'),
  ('INSULIN', 'insulinTreatment'),
  ('ORAL_AND_INSULIN', 'oralAndInsulin'),
  ('NON_INSULIN_INJECTABLE', 'nonInsulinInjectable'),
  ('OTHER', 'otherTreatment'),
];

String _treatmentLabel(String key) => switch (key) {
  'lifestyleOnly' => S.lifestyleOnly,
  'oralMedication' => S.oralMedication,
  'insulinTreatment' => S.insulinTreatment,
  'oralAndInsulin' => S.oralAndInsulin,
  'nonInsulinInjectable' => S.nonInsulinInjectable,
  _ => S.otherTreatment,
};

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  late final _name = TextEditingController(
    text: widget.initial['name'] as String? ?? '',
  );
  late final _phone = TextEditingController(
    text: widget.initial['phone'] as String? ?? '',
  );
  late final _city = TextEditingController(
    text: widget.initial['city'] as String? ?? '',
  );
  late final _country = TextEditingController(
    text: widget.initial['country'] as String? ?? '',
  );
  late final _height = TextEditingController(
    text: (widget.initial['heightCm'] as num?)?.toString() ?? '',
  );
  late final _weight = TextEditingController(
    text: (widget.initial['baselineWeightKg'] as num?)?.toString() ?? '',
  );
  late final _diagnosisYear = TextEditingController(
    text: (widget.initial['diagnosisYear'] as num?)?.toString() ?? '',
  );
  late final _emergencyName = TextEditingController(
    text: widget.initial['emergencyContactName'] as String? ?? '',
  );
  late final _emergencyPhone = TextEditingController(
    text: widget.initial['emergencyContactPhone'] as String? ?? '',
  );
  late final _primaryClinician = TextEditingController(
    text: widget.initial['primaryClinician'] as String? ?? '',
  );

  late DateTime? _dateOfBirth = DateTime.tryParse(
    widget.initial['dateOfBirth'] as String? ?? '',
  );
  late String _sex = widget.initial['sex'] as String? ?? 'UNSPECIFIED';
  late String _treatment =
      widget.initial['treatmentModality'] as String? ?? 'UNSPECIFIED';

  bool _saving = false;
  String? _error;

  /// Admin-defined fields (see api/lib/services/profile-fields.ts), fetched
  /// once when the screen opens. Additive to the fixed fields above — a slow
  /// or failed fetch never blocks editing the built-in ones.
  List<ProfileField> _customFields = [];
  final Map<String, TextEditingController> _customControllers = {};
  final Map<String, DateTime?> _customDates = {};
  final Map<String, String?> _customChoices = {};

  @override
  void initState() {
    super.initState();
    _loadCustomFields();
  }

  Future<void> _loadCustomFields() async {
    final fields = await ProfileFieldsService.instance.fetchActiveFields();
    if (!mounted) return;
    final existing =
        widget.initial['customFieldValues'] as Map<String, dynamic>? ??
        const {};
    setState(() {
      _customFields = fields;
      for (final field in fields) {
        final value = existing[field.key];
        switch (field.fieldType) {
          case 'DATE':
            _customDates[field.key] = value == null
                ? null
                : DateTime.tryParse(value as String);
          case 'CHOICE':
            _customChoices[field.key] = value as String?;
          default:
            _customControllers[field.key] = TextEditingController(
              text: value?.toString() ?? '',
            );
        }
      }
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    _country.dispose();
    _height.dispose();
    _weight.dispose();
    _diagnosisYear.dispose();
    _emergencyName.dispose();
    _emergencyPhone.dispose();
    _primaryClinician.dispose();
    for (final controller in _customControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickCustomDate(ProfileField field) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _customDates[field.key] ?? now,
      firstDate: DateTime(now.year - 100),
      lastDate: now,
      helpText: field.label(AppState.instance.locale),
    );
    if (picked != null) setState(() => _customDates[field.key] = picked);
  }

  /// `null` when every currently-required active field has an answer;
  /// otherwise the label of the first one that doesn't, so the error can
  /// name it rather than just saying "something's missing".
  String? _missingRequiredCustomField() {
    final locale = AppState.instance.locale;
    for (final field in _customFields) {
      if (!field.required) continue;
      final filled = switch (field.fieldType) {
        'DATE' => _customDates[field.key] != null,
        'CHOICE' => (_customChoices[field.key]?.isNotEmpty ?? false),
        _ => (_customControllers[field.key]?.text.trim().isNotEmpty ?? false),
      };
      if (!filled) return field.label(locale);
    }
    return null;
  }

  Map<String, dynamic> _customFieldValuesPayload() {
    final values = <String, dynamic>{};
    for (final field in _customFields) {
      switch (field.fieldType) {
        case 'DATE':
          values[field.key] = _customDates[field.key]?.toIso8601String();
        case 'CHOICE':
          values[field.key] = _customChoices[field.key];
        case 'NUMBER':
          final text = _customControllers[field.key]?.text.trim() ?? '';
          values[field.key] = text.isEmpty ? null : num.tryParse(text);
        default:
          values[field.key] = _emptyToNull(
            _customControllers[field.key]?.text ?? '',
          );
      }
    }
    return values;
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(now.year - 10),
      firstDate: DateTime(now.year - 20),
      lastDate: now,
      helpText: S.dateOfBirth,
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();

    final missingField = _missingRequiredCustomField();
    if (missingField != null) {
      setState(() => _error = '$missingField ${S.isRequired}');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final fields = <String, dynamic>{
      if (_name.text.trim().isNotEmpty) 'name': _name.text.trim(),
      'dateOfBirth': _dateOfBirth?.toIso8601String(),
      'sex': _sex,
      'phone': _emptyToNull(_phone.text),
      'city': _emptyToNull(_city.text),
      'country': _emptyToNull(_country.text),
      'diagnosisYear': int.tryParse(_diagnosisYear.text.trim()),
      'treatmentModality': _treatment,
      'heightCm': double.tryParse(_height.text.trim()),
      'baselineWeightKg': double.tryParse(_weight.text.trim()),
      'emergencyContactName': _emptyToNull(_emergencyName.text),
      'emergencyContactPhone': _emptyToNull(_emergencyPhone.text),
      'primaryClinician': _emptyToNull(_primaryClinician.text),
      if (_customFields.isNotEmpty)
        'customFieldValues': _customFieldValuesPayload(),
    };

    try {
      await ProfileService.instance.updateProfile(fields);
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

  static String? _emptyToNull(String value) =>
      value.trim().isEmpty ? null : value.trim();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(S.editDetails)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 13),
              ),
            ),
            const SizedBox(height: 16),
          ],
          LabeledField(
            icon: Icons.person_outline,
            label: S.name,
            hint: S.name,
            controller: _name,
            whiteFill: true,
          ),
          const SizedBox(height: 14),
          _TapField(
            icon: Icons.cake_outlined,
            label: S.dateOfBirth,
            value: _dateOfBirth == null ? null : _formatDate(_dateOfBirth!),
            onTap: _pickDateOfBirth,
          ),
          const SizedBox(height: 14),
          _ChoiceField(
            icon: Icons.wc_outlined,
            label: S.sex,
            value: _sex,
            options: const [
              ('FEMALE', 'female'),
              ('MALE', 'male'),
              ('PREFER_NOT_TO_SAY', 'notStated'),
            ],
            labelFor: (key) => switch (key) {
              'female' => S.female,
              'male' => S.male,
              _ => S.notStated,
            },
            onChanged: (v) => setState(() => _sex = v),
          ),
          const SizedBox(height: 14),
          LabeledField(
            icon: Icons.event_note_outlined,
            label: S.diagnosisYear,
            hint: S.diagnosisYear,
            controller: _diagnosisYear,
            keyboardType: TextInputType.number,
            whiteFill: true,
          ),
          const SizedBox(height: 24),
          _SectionLabel(S.phone),
          const SizedBox(height: 10),
          LabeledField(
            icon: Icons.call_outlined,
            label: S.phone,
            hint: S.phone,
            controller: _phone,
            keyboardType: TextInputType.phone,
            whiteFill: true,
          ),
          const SizedBox(height: 14),
          LabeledField(
            icon: Icons.location_city_outlined,
            label: S.city,
            hint: S.city,
            controller: _city,
            whiteFill: true,
          ),
          const SizedBox(height: 14),
          LabeledField(
            icon: Icons.public_outlined,
            label: S.country,
            hint: S.country,
            controller: _country,
            whiteFill: true,
          ),
          const SizedBox(height: 24),
          _SectionLabel(S.treatmentModality),
          const SizedBox(height: 10),
          _ChoiceField(
            icon: Icons.medical_services_outlined,
            label: S.treatmentModality,
            value: _treatment,
            options: _treatmentOptions,
            labelFor: _treatmentLabel,
            onChanged: (v) => setState(() => _treatment = v),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: LabeledField(
                  icon: Icons.height_outlined,
                  label: S.heightHint,
                  hint: S.heightHint,
                  controller: _height,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  whiteFill: true,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: LabeledField(
                  icon: Icons.monitor_weight_outlined,
                  label: S.weightHint,
                  hint: S.weightHint,
                  controller: _weight,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  whiteFill: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          LabeledField(
            icon: Icons.local_hospital_outlined,
            label: S.primaryClinician,
            hint: S.primaryClinician,
            controller: _primaryClinician,
            whiteFill: true,
          ),
          const SizedBox(height: 24),
          _SectionLabel(S.emergencyContact),
          const SizedBox(height: 10),
          LabeledField(
            icon: Icons.contact_emergency_outlined,
            label: S.emergencyContactName,
            hint: S.emergencyContactName,
            controller: _emergencyName,
            whiteFill: true,
          ),
          const SizedBox(height: 14),
          LabeledField(
            icon: Icons.call_outlined,
            label: S.emergencyContactPhone,
            hint: S.emergencyContactPhone,
            controller: _emergencyPhone,
            keyboardType: TextInputType.phone,
            whiteFill: true,
          ),
          if (_customFields.isNotEmpty)
            _CustomFieldsSection(
              fields: _customFields,
              controllers: _customControllers,
              dates: _customDates,
              choices: _customChoices,
              onDateTap: _pickCustomDate,
              onChoiceChanged: (key, value) =>
                  setState(() => _customChoices[key] = value),
            ),
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

  static String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
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

/// A field whose value is picked, not typed — matches [LabeledField]'s
/// look so the form reads as one consistent set of rows.
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
            Text(
              value ?? label,
              style: TextStyle(
                fontSize: 14.5,
                color: value == null
                    ? Colors.black.withValues(alpha: 0.5)
                    : AppTheme.deep,
              ),
            ),
            const Spacer(),
            const Icon(Icons.chevron_right, color: AppTheme.primary),
          ],
        ),
      ),
    );
  }
}

/// A row of choice chips for a small enum — cheaper to scan than a dropdown
/// for the handful of options every field here has.
class _ChoiceField extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final List<(String, String)> options;
  final String Function(String) labelFor;
  final ValueChanged<String> onChanged;

  const _ChoiceField({
    required this.icon,
    required this.label,
    required this.value,
    required this.options,
    required this.labelFor,
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
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: Colors.black.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((option) {
            final (key, labelKey) = option;
            final selected = key == value;
            return ChoiceChip(
              label: Text(labelFor(labelKey)),
              selected: selected,
              onSelected: (_) => onChanged(key),
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

/// Admin-defined fields, grouped under their configured section headings and
/// rendered after every built-in field — additive, never mixed into a
/// built-in section, so the fixed layout above never shifts around
/// depending on what an admin has configured.
class _CustomFieldsSection extends StatelessWidget {
  final List<ProfileField> fields;
  final Map<String, TextEditingController> controllers;
  final Map<String, DateTime?> dates;
  final Map<String, String?> choices;
  final ValueChanged<ProfileField> onDateTap;
  final void Function(String key, String value) onChoiceChanged;

  const _CustomFieldsSection({
    required this.fields,
    required this.controllers,
    required this.dates,
    required this.choices,
    required this.onDateTap,
    required this.onChoiceChanged,
  });

  static String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  @override
  Widget build(BuildContext context) {
    final locale = AppState.instance.locale;
    final bySection = <String, List<ProfileField>>{};
    for (final field in fields) {
      bySection.putIfAbsent(field.section, () => []).add(field);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in bySection.entries) ...[
          const SizedBox(height: 24),
          _SectionLabel(entry.key),
          const SizedBox(height: 10),
          for (var i = 0; i < entry.value.length; i++) ...[
            if (i > 0) const SizedBox(height: 14),
            _buildField(entry.value[i], locale),
          ],
        ],
      ],
    );
  }

  Widget _buildField(ProfileField field, String locale) {
    final label = field.required
        ? '${field.label(locale)} *'
        : field.label(locale);

    switch (field.fieldType) {
      case 'DATE':
        final value = dates[field.key];
        return _TapField(
          icon: Icons.event_outlined,
          label: label,
          value: value == null ? null : _formatDate(value),
          onTap: () => onDateTap(field),
        );
      case 'CHOICE':
        return _ChoiceField(
          icon: Icons.list_alt_outlined,
          label: label,
          value: choices[field.key] ?? '',
          options: field.options.map((o) => (o.value, o.value)).toList(),
          labelFor: (value) {
            final option = field.options.firstWhere(
              (o) => o.value == value,
              orElse: () => field.options.first,
            );
            return locale == 'ta' && (option.labelTa?.isNotEmpty ?? false)
                ? option.labelTa!
                : option.labelEn;
          },
          onChanged: (v) => onChoiceChanged(field.key, v),
        );
      case 'NUMBER':
        return LabeledField(
          icon: Icons.pin_outlined,
          label: label,
          hint: field.hint(locale) ?? field.label(locale),
          controller: controllers[field.key]!,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          whiteFill: true,
        );
      default:
        return LabeledField(
          icon: Icons.edit_note_outlined,
          label: label,
          hint: field.hint(locale) ?? field.label(locale),
          controller: controllers[field.key]!,
          whiteFill: true,
        );
    }
  }
}

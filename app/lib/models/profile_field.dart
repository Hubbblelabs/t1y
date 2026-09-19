/// An admin-defined field on the profile-edit form, on top of the fixed set
/// the app has always had (name, phone, height, …). Mirrors
/// `ProfileFieldDefinition` in the backend schema — see
/// api/lib/services/profile-fields.ts for the full model.
class ProfileFieldChoiceOption {
  final String value;
  final String labelEn;
  final String? labelTa;

  const ProfileFieldChoiceOption({
    required this.value,
    required this.labelEn,
    this.labelTa,
  });

  factory ProfileFieldChoiceOption.fromJson(Map<String, dynamic> json) {
    return ProfileFieldChoiceOption(
      value: json['value'] as String,
      labelEn: json['labelEn'] as String,
      labelTa: json['labelTa'] as String?,
    );
  }
}

class ProfileField {
  final String id;
  final String key;
  final String fieldType; // TEXT | NUMBER | DATE | CHOICE
  final String section;
  final bool required;
  final String labelEn;
  final String? labelTa;
  final String? hintEn;
  final String? hintTa;
  final List<ProfileFieldChoiceOption> options;

  const ProfileField({
    required this.id,
    required this.key,
    required this.fieldType,
    required this.section,
    required this.required,
    required this.labelEn,
    this.labelTa,
    this.hintEn,
    this.hintTa,
    this.options = const [],
  });

  /// The label in whichever language is currently active — falls back to
  /// English when no Tamil translation has been given for this field yet.
  String label(String locale) =>
      locale == 'ta' && (labelTa?.trim().isNotEmpty ?? false)
      ? labelTa!
      : labelEn;

  String? hint(String locale) =>
      locale == 'ta' && (hintTa?.trim().isNotEmpty ?? false) ? hintTa : hintEn;

  factory ProfileField.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'] as List<dynamic>?;
    return ProfileField(
      id: json['id'] as String,
      key: json['key'] as String,
      fieldType: json['fieldType'] as String,
      section: json['section'] as String? ?? 'Additional details',
      required: json['required'] as bool? ?? false,
      labelEn: json['labelEn'] as String,
      labelTa: json['labelTa'] as String?,
      hintEn: json['hintEn'] as String?,
      hintTa: json['hintTa'] as String?,
      options: rawOptions == null
          ? const []
          : rawOptions
                .map(
                  (o) => ProfileFieldChoiceOption.fromJson(
                    o as Map<String, dynamic>,
                  ),
                )
                .toList(),
    );
  }
}

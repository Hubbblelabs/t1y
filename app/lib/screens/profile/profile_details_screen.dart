import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../theme/app_theme.dart';
import 'profile_edit_screen.dart';

/// Every field on file for this child, filled or not — plain rows, no card.
///
/// The compact ID card only ever shows the handful of fields that make it
/// an identity card; everything else (contact, treatment, emergency
/// contact) lives here instead of being squeezed into that card, which is
/// exactly the complaint this screen exists to fix. A blank field still
/// gets its own row, labelled "Not provided" — "view all" means all of
/// them, not just the ones that happen to be filled in.
class ProfileDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> me;

  const ProfileDetailsScreen({super.key, required this.me});

  @override
  Widget build(BuildContext context) {
    final profile = me['profile'] as Map<String, dynamic>? ?? {};
    final dobRaw = profile['dateOfBirth'] as String?;
    final dob = dobRaw == null ? null : DateTime.tryParse(dobRaw);
    final heightCm = (profile['heightCm'] as num?)?.toDouble();
    final weightKg = (profile['baselineWeightKg'] as num?)?.toDouble();
    final bmi = (heightCm != null && weightKg != null && heightCm > 0)
        ? weightKg / ((heightCm / 100) * (heightCm / 100))
        : null;

    return Scaffold(
      backgroundColor: AppTheme.lightest,
      appBar: AppBar(
        title: Text(S.viewAllDetails),
        backgroundColor: AppTheme.lightest,
        actions: [
          TextButton(
            onPressed: () async {
              final changed = await Navigator.of(context).push<bool>(
                MaterialPageRoute(
                  builder: (_) => ProfileEditScreen(initial: profile),
                ),
              );
              if (changed == true && context.mounted)
                Navigator.of(context).pop(true);
            },
            child: Text(S.editDetails),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          Text(
            S.viewAllDetailsHint,
            style: TextStyle(
              fontSize: 12.5,
              color: Colors.black.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 16),
          _Section(
            title: S.account,
            rows: [
              (S.idNo, profile['participantCode'] as String?),
              (S.account, me['email'] as String?),
            ],
          ),
          _Section(
            title: S.yourDetails,
            rows: [
              (S.name, profile['name'] as String?),
              (S.dateOfBirth, dob == null ? null : _formatDate(dob)),
              (S.age, dob == null ? null : S.years(_ageFrom(dob))),
              (S.sex, _prettySex(profile['sex'] as String?)),
              (S.diagnosisYear, (profile['diagnosisYear'] as num?)?.toString()),
            ],
          ),
          _Section(
            title: S.contact,
            rows: [
              (S.phone, profile['phone'] as String?),
              (S.city, profile['city'] as String?),
              (S.country, profile['country'] as String?),
            ],
          ),
          _Section(
            title: S.healthDetails,
            rows: [
              (
                S.treatmentModality,
                _prettyTreatment(profile['treatmentModality'] as String?),
              ),
              (
                S.height,
                heightCm == null ? null : '${heightCm.toStringAsFixed(0)} cm',
              ),
              (
                S.weight,
                weightKg == null ? null : '${weightKg.toStringAsFixed(1)} kg',
              ),
              (S.bmi, bmi == null ? null : bmi.toStringAsFixed(1)),
              (S.primaryClinician, profile['primaryClinician'] as String?),
            ],
          ),
          _Section(
            title: S.emergencyContact,
            rows: [
              (
                S.emergencyContactName,
                profile['emergencyContactName'] as String?,
              ),
              (
                S.emergencyContactPhone,
                profile['emergencyContactPhone'] as String?,
              ),
            ],
          ),
        ],
      ),
    );
  }

  static int _ageFrom(DateTime dob) {
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day))
      age--;
    return age;
  }

  static String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}';

  static String? _prettySex(String? value) => switch (value) {
    'FEMALE' => S.female,
    'MALE' => S.male,
    'PREFER_NOT_TO_SAY' => S.notStated,
    _ => null,
  };

  static String? _prettyTreatment(String? value) => switch (value) {
    'LIFESTYLE_ONLY' => S.lifestyleOnly,
    'ORAL_MEDICATION' => S.oralMedication,
    'INSULIN' => S.insulinTreatment,
    'ORAL_AND_INSULIN' => S.oralAndInsulin,
    'NON_INSULIN_INJECTABLE' => S.nonInsulinInjectable,
    'OTHER' => S.otherTreatment,
    _ => null,
  };
}

class _Section extends StatelessWidget {
  final String title;
  final List<(String, String?)> rows;

  const _Section({required this.title, required this.rows});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.deep.withValues(alpha: 0.06)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: AppTheme.primary,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 10),
            for (final (label, value) in rows)
              _DetailRow(label: label, value: value),
          ],
        ),
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
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                color: Colors.black.withValues(alpha: 0.5),
              ),
            ),
          ),
          Expanded(
            child: Text(
              filled ? value! : S.notProvided,
              style: TextStyle(
                fontSize: 14,
                fontWeight: filled ? FontWeight.w600 : FontWeight.w500,
                fontStyle: filled ? FontStyle.normal : FontStyle.italic,
                color: filled
                    ? AppTheme.deep
                    : Colors.black.withValues(alpha: 0.35),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

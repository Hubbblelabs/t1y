import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../models/question.dart';
import '../../providers/app_state.dart';
import '../../services/profile_field_rules.dart';
import '../../services/question_service.dart';
import '../../services/question_values.dart';
import '../../theme/app_theme.dart';
import 'profile_edit_screen.dart';

/// Every question on file for this child, answered or not — plain rows, no card.
///
/// The compact ID card only ever shows the handful of fields that make it an
/// identity card; everything else lives here. A blank question still gets its
/// own row, labelled "Not provided" — "view all" means all of them, not just
/// the ones that happen to be filled in.
///
/// The rows come from [QuestionService], the same list the edit screen uses,
/// so a question an admin adds appears here too. (This screen used to list a
/// fixed set and never showed answers to added questions at all.)
class ProfileDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> me;

  const ProfileDetailsScreen({super.key, required this.me});

  @override
  State<ProfileDetailsScreen> createState() => _ProfileDetailsScreenState();
}

class _ProfileDetailsScreenState extends State<ProfileDetailsScreen> {
  List<Question>? _questions;

  @override
  void initState() {
    super.initState();
    QuestionService.instance.profileQuestions().then((questions) {
      if (mounted) setState(() => _questions = questions);
    });
  }

  Map<String, dynamic> get _profile =>
      widget.me['profile'] as Map<String, dynamic>? ?? {};

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    final questions = _questions;

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
              if (changed == true && context.mounted) {
                Navigator.of(context).pop(true);
              }
            },
            child: Text(S.editDetails),
          ),
        ],
      ),
      body: questions == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
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
                    (S.account, widget.me['email'] as String?),
                  ],
                ),
                ..._sections(questions, profile),
              ],
            ),
    );
  }

  List<Widget> _sections(
    List<Question> questions,
    Map<String, dynamic> profile,
  ) {
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

    return [
      for (final entry in bySection.entries)
        _Section(
          title: sectionTitle(entry.key),
          rows: [
            for (final question in entry.value) ...[
              (
                question.label(locale),
                displayFor(question, answerFor(question, profile), locale),
              ),
              // Worked out rather than stored, so they are not questions —
              // shown beside the answers they come from.
              if (question.key == 'dateOfBirth' && dob != null)
                (S.age, S.years(ageInYears(dob))),
              if (question.key == 'baselineWeightKg' && bmi != null)
                (S.bmi, bmi.toStringAsFixed(1)),
            ],
          ],
        ),
    ];
  }
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

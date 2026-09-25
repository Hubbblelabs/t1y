import 'package:flutter/material.dart';

import '../../l10n/strings.dart';
import '../../services/api_client.dart';
import '../../services/household_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/error_banner.dart';
import '../../widgets/labeled_field.dart';

/// Enrols another child under the signed-in parent's household.
///
/// Kept deliberately short — name, date of birth — rather than repeating the
/// full chat-style sign-up. The coordinator completes the clinical detail
/// when they accept the enrolment, and a parent adding a second child has
/// already answered the study's questions once.
///
/// Pops with the new child's ID on success so the caller can show it.
class AddChildScreen extends StatefulWidget {
  const AddChildScreen({super.key});

  @override
  State<AddChildScreen> createState() => _AddChildScreenState();
}

class _AddChildScreenState extends State<AddChildScreen> {
  final _name = TextEditingController();
  DateTime? _dateOfBirth;

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(now.year - 10),
      // The study enrols children aged 6-15, so the picker opens on the
      // plausible span rather than the last two centuries.
      firstDate: DateTime(now.year - 18),
      lastDate: now,
      helpText: S.dateOfBirth,
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = S.bothText(() => S.fillAllFields));
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final childId = await HouseholdService.instance.addChild(
        name: name,
        dateOfBirth: _dateOfBirth,
      );
      if (!mounted) return;
      Navigator.of(context).pop(childId);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.bothMessage;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = S.bothText(() => S.couldNotLoad);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final dob = _dateOfBirth;

    return Scaffold(
      appBar: AppBar(title: Text(S.addChild)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.lightest,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, size: 18, color: AppTheme.deep),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    S.awaitingApprovalHint,
                    style: const TextStyle(fontSize: 12.5, height: 1.35),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          if (_error != null) ...[
            ErrorBanner(message: _error!),
            const SizedBox(height: 16),
          ],
          LabeledField(
            icon: Icons.person_outline,
            label: S.name,
            hint: S.name,
            controller: _name,
            autofocus: true,
          ),
          const SizedBox(height: 16),
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
              decoration: BoxDecoration(
                color: AppTheme.lightest,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.cake_outlined,
                    size: 18,
                    color: AppTheme.deep,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    dob == null
                        ? S.dateOfBirth
                        : '${dob.day.toString().padLeft(2, '0')}-'
                              '${dob.month.toString().padLeft(2, '0')}-${dob.year}',
                    style: TextStyle(
                      fontSize: 14.5,
                      color: dob == null
                          ? AppTheme.inkSoft
                          : AppTheme.deep,
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right, color: AppTheme.primary),
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(S.addChild),
          ),
        ],
      ),
    );
  }
}

/// One enrolled child in the signed-in parent's household.
///
/// [childId] is the study's participant code (e.g. "P0007") — the same value
/// shown on the profile screen and accepted as a sign-in identifier, so a
/// child can open their own record without going through the picker.
class Child {
  final String childId;

  /// False when [childId] is an internal stand-in rather than a real
  /// participant code — which happens for an account whose profile hasn't
  /// been created yet. Such an ID still selects the child, but must never be
  /// shown as "their child ID", because it isn't one and won't sign anyone in.
  final bool hasParticipantCode;

  final String name;
  final DateTime? dateOfBirth;

  /// Mirrors the backend's `UserStatus`. Anything other than "ACTIVE" means
  /// the study coordinator hasn't accepted this child's enrolment yet, and
  /// signing in as them will be refused — the picker says so rather than
  /// letting the parent tap through to an error.
  final String status;

  /// True for the child whose session is currently open. Only set by the
  /// siblings endpoint, never by the sign-in picker (nobody is current yet).
  final bool isCurrent;

  const Child({
    required this.childId,
    this.hasParticipantCode = true,
    required this.name,
    this.dateOfBirth,
    required this.status,
    this.isCurrent = false,
  });

  bool get isActive => status == 'ACTIVE';

  /// Up to two initials for the picker's avatar, from the first letter of
  /// each of the first two words in the name — falling back to one when
  /// there's only a single word.
  String get initials {
    final words = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.isEmpty) return '';
    final first = words[0][0];
    final second = words.length > 1 ? words[1][0] : '';
    return '$first$second'.toUpperCase();
  }

  int? get ageYears {
    final dob = dateOfBirth;
    if (dob == null) return null;
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day))
      age--;
    return age;
  }

  factory Child.fromJson(Map<String, dynamic> json) => Child(
    childId: json['childId'] as String,
    hasParticipantCode: json['hasParticipantCode'] as bool? ?? true,
    name: json['name'] as String? ?? '',
    dateOfBirth: json['dateOfBirth'] == null
        ? null
        : DateTime.tryParse(json['dateOfBirth'] as String),
    status: json['status'] as String? ?? 'PENDING',
    isCurrent: json['isCurrent'] as bool? ?? false,
  );
}

/// Result of the first sign-in step: who this identifier covers.
class HouseholdLookup {
  final String? parentName;
  final List<Child> children;

  /// True when the identifier named exactly one child — a child ID, or a
  /// parent with a single enrolled child — so the app signs straight in
  /// instead of showing a picker with one option.
  final bool isSingleChild;

  const HouseholdLookup({
    required this.parentName,
    required this.children,
    required this.isSingleChild,
  });

  factory HouseholdLookup.fromJson(Map<String, dynamic> json) =>
      HouseholdLookup(
        parentName: json['parentName'] as String?,
        children: (json['children'] as List<dynamic>? ?? [])
            .map((c) => Child.fromJson(c as Map<String, dynamic>))
            .toList(),
        isSingleChild: json['isSingleChild'] as bool? ?? false,
      );
}

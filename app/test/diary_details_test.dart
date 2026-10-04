import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/services/diary_details.dart';

Map<String, dynamic> _me({
  required DateTime created,
  Map<String, dynamic> profile = const {},
}) => {'createdAt': created.toUtc().toIso8601String(), 'profile': profile};

const _complete = {
  'sex': 'FEMALE',
  'dateOfBirth': '2014-05-01',
  'phone': '9876543210',
  'heightCm': 140,
  'baselineWeightKg': 35,
  'primaryClinician': 'Dr Meena',
  'customFieldValues': {'address': '12 Race Course', 'educatorName': 'Sister Anu'},
};

void main() {
  final now = DateTime(2026, 10, 10, 12);

  test('lists every blank required detail, including custom ones', () {
    final me = _me(
      created: now,
      profile: {'sex': 'UNSPECIFIED', 'phone': ' ', 'heightCm': 140},
    );
    expect(
      DiaryDetails.missing(me),
      containsAll([
        'sex',
        'dateOfBirth',
        'phone',
        'address',
        'baselineWeightKg',
        'primaryClinician',
        'educatorName',
      ]),
    );
    expect(DiaryDetails.missing(me), isNot(contains('heightCm')));
  });

  test('complete details mean nothing is missing and nothing is due', () {
    final me = _me(
      created: now.subtract(const Duration(days: 30)),
      profile: Map<String, dynamic>.from(_complete),
    );
    expect(DiaryDetails.missing(me), isEmpty);
    expect(DiaryDetails.due(me, now), isFalse);
  });

  test('asks only once a few days have passed', () {
    final profile = <String, dynamic>{'sex': 'FEMALE'};
    expect(
      DiaryDetails.due(
        _me(created: now.subtract(const Duration(days: 2)), profile: profile),
        now,
      ),
      isFalse,
    );
    expect(
      DiaryDetails.due(
        _me(created: now.subtract(const Duration(days: 3)), profile: profile),
        now,
      ),
      isTrue,
    );
  });

  test('hospital numbers are optional and never count as missing', () {
    final me = _me(
      created: now.subtract(const Duration(days: 10)),
      profile: Map<String, dynamic>.from(_complete),
    );
    expect(DiaryDetails.missing(me), isNot(contains('hospitalNumber')));
  });

  test('no profile means nothing to ask about yet', () {
    expect(DiaryDetails.missing(null), isEmpty);
    expect(DiaryDetails.due(null, now), isFalse);
  });
}

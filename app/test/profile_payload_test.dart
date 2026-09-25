import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/config/default_questions.dart';
import 'package:t1dpe/models/question.dart';
import 'package:t1dpe/services/profile_service.dart';

/// Where each answer ends up. Getting one into the wrong place is a silent
/// data-loss bug rather than a crash, so it is tested directly.
void main() {
  final signup = defaultQuestions.where((q) => q.showOnSignup).toList();

  test('routes the four sign-up answers to real profile columns', () {
    final payload = ProfileService.buildProfilePayload({
      'name': 'Anbu',
      'dateOfBirth': '2016-04-10',
      'sex': 'FEMALE',
      'diagnosisYear': '2020',
    }, signup);

    expect(payload['name'], 'Anbu');
    expect(payload['dateOfBirth'], '2016-04-10');
    expect(payload['sex'], 'FEMALE');
    expect(payload['customFieldValues'], isNull);
  });

  test('sends a year as a whole number, which is all the server accepts', () {
    final payload = ProfileService.buildProfilePayload({
      'diagnosisYear': '2020',
    }, signup);

    expect(payload['diagnosisYear'], isA<int>());
    expect(payload['diagnosisYear'], 2020);
  });

  test('keeps a decimal measurement as a decimal', () {
    final payload = ProfileService.buildProfilePayload({
      'heightCm': '132.5',
    }, defaultQuestions);
    expect(payload['heightCm'], 132.5);
  });

  test('puts an added question in the free-form bucket, not a column', () {
    const school = Question(
      key: 'school',
      fieldType: 'TEXT',
      labelEn: 'School',
      showOnSignup: true,
    );
    final payload = ProfileService.buildProfilePayload(
      {'name': 'Anbu', 'school': 'Greenwood'},
      [...signup, school],
    );

    expect(payload.containsKey('school'), isFalse);
    expect(payload['customFieldValues'], {'school': 'Greenwood'});
  });

  test('leaves out a skipped or blank answer rather than sending it empty', () {
    final payload = ProfileService.buildProfilePayload({
      'name': 'Anbu',
      'phone': '   ',
    }, defaultQuestions);

    expect(payload.containsKey('phone'), isFalse);
  });

  test('drops a number that cannot be read rather than sending nonsense', () {
    final payload = ProfileService.buildProfilePayload({
      'heightCm': 'tall',
    }, defaultQuestions);

    expect(payload.containsKey('heightCm'), isFalse);
  });

  test('always records Type 1, as every participant in this study has it', () {
    expect(
      ProfileService.buildProfilePayload({}, signup)['diabetesType'],
      'TYPE_1',
    );
  });

  group('editing', () {
    test('clears an optional answer the parent removed', () {
      final payload = ProfileService.buildProfilePayload(
        {'name': 'Anbu'},
        defaultQuestions,
        sendBlanksAsNull: true,
      );

      expect(payload.containsKey('phone'), isTrue);
      expect(payload['phone'], isNull);
    });

    test('never clears a pick-one that was simply not chosen', () {
      final payload = ProfileService.buildProfilePayload(
        {'name': 'Anbu'},
        defaultQuestions,
        sendBlanksAsNull: true,
      );

      expect(payload.containsKey('sex'), isFalse);
      expect(payload.containsKey('treatmentModality'), isFalse);
    });

    test('never blanks a required question', () {
      final payload = ProfileService.buildProfilePayload(
        {},
        defaultQuestions,
        sendBlanksAsNull: true,
      );

      expect(payload.containsKey('name'), isFalse);
      expect(payload.containsKey('dateOfBirth'), isFalse);
    });

    test('clears an added question inside the free-form bucket', () {
      const school = Question(
        key: 'school',
        fieldType: 'TEXT',
        labelEn: 'School',
      );
      final payload = ProfileService.buildProfilePayload({}, [
        school,
      ], sendBlanksAsNull: true);

      expect(payload['customFieldValues'], {'school': null});
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import 'package:t1dpe/services/api_client.dart';

/// Regression test for a real user-reported bug: "Server sent an unexpected
/// response" appeared when entering/setting a PIN even though the save had
/// actually succeeded. The cause was `unwrapApiResponse` calling
/// `jsonDecode('')` unconditionally — every `noContent()` route on the
/// backend (204, e.g. POST /api/mpin) sends an empty body on success, and
/// decoding an empty string throws.
void main() {
  group('unwrapApiResponse', () {
    test('a 204 with an empty body returns null instead of throwing', () {
      final response = http.Response('', 204);
      expect(unwrapApiResponse(response), isNull);
    });

    test('a 200 with an empty body also returns null (belt and braces)', () {
      final response = http.Response('', 200);
      expect(unwrapApiResponse(response), isNull);
    });

    test('a normal 200 JSON envelope still decodes as before', () {
      final response = http.Response('{"success":true,"data":{"ok":true}}', 200);
      expect(unwrapApiResponse(response), {
        'success': true,
        'data': {'ok': true},
      });
    });

    test('a 201 with a JSON body decodes too, not just 200', () {
      final response = http.Response('{"success":true,"data":{"id":"x"}}', 201);
      expect(unwrapApiResponse(response), isNotNull);
    });

    test('a non-2xx error envelope still throws ApiException with the server message', () {
      final response = http.Response(
        '{"success":false,"error":{"code":"FORBIDDEN","message":"Nope."}}',
        403,
      );
      expect(
        () => unwrapApiResponse(response),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'statusCode', 403)
              .having((e) => e.code, 'code', 'FORBIDDEN')
              .having((e) => e.message, 'message', 'Nope.'),
        ),
      );
    });

    test('an empty body on a non-2xx status throws rather than returning null', () {
      final response = http.Response('', 500);
      expect(
        () => unwrapApiResponse(response),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 500)),
      );
    });

    test('genuinely malformed JSON on a 200 still reports PARSE_ERROR', () {
      final response = http.Response('not json at all', 200);
      expect(
        () => unwrapApiResponse(response),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'PARSE_ERROR')),
      );
    });
  });
}

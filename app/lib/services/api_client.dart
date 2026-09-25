import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../l10n/strings.dart';

/// Thrown for any non-2xx response. Carries the server's own error message
/// (from the `{success:false,error:{code,message}}` envelope every route in
/// the backend returns) so the UI can show something meaningful instead of
/// "Exception: 400".
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String rawMessage;
  ApiException(this.statusCode, this.code, this.rawMessage);

  /// The message in the app's language. The server writes English; in Tamil it
  /// is translated, never shown untranslated.
  String get message => S.apiMessage(statusCode, code, rawMessage);

  /// English with the Tamil beneath, for the sign-in and sign-up screens.
  String get bothMessage {
    final en = S.inLocale(
      'en',
      () => S.apiMessage(statusCode, code, rawMessage),
    );
    final ta = S.inLocale(
      'ta',
      () => S.apiMessage(statusCode, code, rawMessage),
    );
    return en == ta ? en : '$en\n$ta';
  }

  @override
  String toString() => message;
}

/// Unwraps a raw HTTP response into the backend's `{success,data|error}`
/// envelope — or, for a `noContent()` route, into `null`.
///
/// Pulled out of [ApiClient] as a free function (rather than a private
/// method) specifically so it can be unit-tested directly against
/// constructed [http.Response] objects, with no network and no Flutter
/// bindings — `flutter test` fakes every real HTTP call, so a body-parsing
/// bug like this one is otherwise only found by clicking through the app.
///
/// A success response can legitimately have no body at all: every
/// `noContent()` route on the backend (204 — setting an MPIN, deleting a
/// record) sends an empty one on purpose. Calling `jsonDecode('')`
/// unconditionally on every response used to throw here, and was reported
/// by a real user as "the server sent an unexpected response" on an action
/// (setting a PIN) that had actually already succeeded.
@visibleForTesting
dynamic unwrapApiResponse(http.Response response) {
  if (response.body.isEmpty) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return null;
    }
    throw ApiException(response.statusCode, 'UNKNOWN', 'Something went wrong.');
  }

  Map<String, dynamic> body;
  try {
    body = jsonDecode(response.body) as Map<String, dynamic>;
  } catch (_) {
    throw ApiException(
      response.statusCode,
      'PARSE_ERROR',
      'The server sent an unexpected response.',
    );
  }

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return body;
  }

  final error = body['error'] as Map<String, dynamic>?;
  throw ApiException(
    response.statusCode,
    (error?['code'] as String?) ?? 'UNKNOWN',
    (error?['message'] as String?) ?? 'Something went wrong.',
  );
}

/// How long any single request may take before it is abandoned.
///
/// `package:http` has no timeout of its own. A request to an address that
/// does not answer — a laptop that changed Wi-Fi, a server that is not
/// running, a phone in a lift — simply waits for the operating system to give
/// up, which on iOS is over a minute. Every screen that awaited one sat on a
/// blank spinner for that long, which from the outside is indistinguishable
/// from the app having crashed.
const apiRequestTimeout = Duration(seconds: 15);

/// Thin wrapper around `http` that attaches the bearer token (Better Auth's
/// `bearer()` plugin — see api/lib/auth/auth.ts) and unwraps the response
/// envelope. One instance per app, held by the widget tree via a
/// [ChangeNotifier]-free singleton — deliberately not using a DI package for
/// an app this size.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  static const _secureStorage = FlutterSecureStorage();
  static const _tokenKey = 'auth_bearer_token';

  String? _token;

  Future<String?> get token async {
    _token ??= await _secureStorage.read(key: _tokenKey);
    return _token;
  }

  Future<void> setToken(String? token) async {
    _token = token;
    if (token == null) {
      await _secureStorage.delete(key: _tokenKey);
    } else {
      await _secureStorage.write(key: _tokenKey, value: token);
    }
  }

  Future<bool> get isSignedIn async => (await token) != null;

  Future<Map<String, String>> _headers({bool json = true}) async {
    final headers = <String, String>{};
    if (json) headers['Content-Type'] = 'application/json';
    final t = await token;
    if (t != null) headers['Authorization'] = 'Bearer $t';
    return headers;
  }

  Future<Uri> _uri(String path, [Map<String, String>? query]) async {
    final base = await ApiConfig.getBaseUrl();
    return Uri.parse('$base$path').replace(queryParameters: query);
  }

  dynamic _unwrap(http.Response response) => unwrapApiResponse(response);

  /// Sends a request, giving up after [apiRequestTimeout] and turning every
  /// way the network can fail into one [ApiException] a parent can act on.
  ///
  /// Status code 0 marks "never got an answer", which is how callers can tell
  /// a dead connection from the server refusing something.
  Future<http.Response> _send(Future<http.Response> Function() request) async {
    try {
      return await request().timeout(apiRequestTimeout);
    } on TimeoutException {
      throw ApiException(
        0,
        'TIMEOUT',
        'The server is taking too long to answer. Check your connection and try again.',
      );
    } on SocketException {
      throw ApiException(
        0,
        'NETWORK',
        'Could not reach the server. Check your connection and try again.',
      );
    } on http.ClientException {
      throw ApiException(
        0,
        'NETWORK',
        'Could not reach the server. Check your connection and try again.',
      );
    }
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final uri = await _uri(path, query);
    final headers = await _headers(json: false);
    return _unwrap(await _send(() => http.get(uri, headers: headers)));
  }

  /// A GET for the public sign-up endpoints, which must work before there is a
  /// token and must not send a stale one.
  Future<dynamic> getPublic(String path, {Map<String, String>? query}) async {
    final uri = await _uri(path, query);
    return _unwrap(await _send(() => http.get(uri)));
  }

  Future<dynamic> post(String path, {Object? body}) async {
    final uri = await _uri(path);
    final headers = await _headers();
    final encoded = body == null ? null : jsonEncode(body);
    return _unwrap(
      await _send(() => http.post(uri, headers: headers, body: encoded)),
    );
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    final uri = await _uri(path);
    final headers = await _headers();
    final encoded = body == null ? null : jsonEncode(body);
    return _unwrap(
      await _send(() => http.patch(uri, headers: headers, body: encoded)),
    );
  }

  Future<void> delete(String path, {Object? body}) async {
    final uri = await _uri(path);
    final headers = await _headers(json: body != null);
    final encoded = body == null ? null : jsonEncode(body);
    _unwrap(
      await _send(() => http.delete(uri, headers: headers, body: encoded)),
    );
  }
}

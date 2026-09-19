import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

/// Thrown for any non-2xx response. Carries the server's own error message
/// (from the `{success:false,error:{code,message}}` envelope every route in
/// the backend returns) so the UI can show something meaningful instead of
/// "Exception: 400".
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  ApiException(this.statusCode, this.code, this.message);

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
    throw ApiException(response.statusCode, 'PARSE_ERROR', 'The server sent an unexpected response.');
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

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final response = await http.get(await _uri(path, query), headers: await _headers(json: false));
    return _unwrap(response);
  }

  Future<dynamic> post(String path, {Object? body}) async {
    final response = await http.post(
      await _uri(path),
      headers: await _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _unwrap(response);
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    final response = await http.patch(
      await _uri(path),
      headers: await _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _unwrap(response);
  }

  Future<void> delete(String path) async {
    final response = await http.delete(await _uri(path), headers: await _headers(json: false));
    _unwrap(response);
  }
}

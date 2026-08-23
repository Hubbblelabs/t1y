import 'dart:convert';

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

  dynamic _unwrap(http.Response response) {
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

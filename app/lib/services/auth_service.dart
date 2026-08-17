import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'api_client.dart';

/// Better Auth's `sign-in/email` endpoint returns the bearer token in a
/// response header (`set-auth-token`) as well as in the JSON body's `token`
/// field — the mobile client reads the body field, which is simpler than
/// threading response headers through `http`'s API.
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  /// Emails known to already have accounts, for [checkEmailExists]'s mock —
  /// see that method's doc for why this isn't a real check yet.
  static const _knownTestEmails = {
    'amara.adeyemi@example.com',
    'bilal.haddad@example.com',
    'chen.okafor@example.com',
    'super.admin@example.com',
    'admin@example.com',
  };

  static const _networkTimeout = Duration(seconds: 15);

  Future<void> signIn({required String email, required String password}) async {
    final base = await ApiConfig.getBaseUrl();
    final response = await http
        .post(
          Uri.parse('$base/api/auth/sign-in/email'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email, 'password': password}),
        )
        .timeout(_networkTimeout);

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = (body['message'] as String?) ?? 'Sign-in failed.';
      throw ApiException(response.statusCode, 'AUTH_FAILED', message);
    }

    final token = body['token'] as String?;
    if (token == null) {
      throw ApiException(response.statusCode, 'AUTH_FAILED', 'No session token was returned.');
    }
    await ApiClient.instance.setToken(token);
  }

  /// Whether an account already exists for this email — decides whether the
  /// entry screen asks for a password (returning user) or starts the sign-up
  /// chat (new user).
  ///
  /// This is a **mock**. The backend has no endpoint that answers this
  /// question — and deliberately so: telling an unauthenticated caller
  /// whether an email is registered is itself a (mild) information leak that
  /// Better Auth avoids by returning a generic "invalid credentials" error
  /// from sign-in either way. A real implementation needs a considered
  /// design (e.g. rate-limited, generic-enough response) which is backend
  /// work, not a UI concern — see the app's known gaps in README.md. For now
  /// this recognises the seeded test accounts from docs/TEST-CREDENTIALS.md
  /// so the two-path UI is demonstrable; every other address is treated as
  /// new.
  Future<bool> checkEmailExists(String email) async {
    await Future.delayed(const Duration(milliseconds: 350));
    return _knownTestEmails.contains(email.trim().toLowerCase());
  }

  /// Creates an account via Better Auth's `sign-up/email` endpoint.
  ///
  /// Does **not** sign the user in — `emailAndPassword.autoSignIn` is `false`
  /// on the backend (see `api/lib/auth/auth.ts`), and accounts default to
  /// `requireEmailVerification: true`, so a freshly created account can't
  /// necessarily sign in immediately either. This is the backend limitation
  /// flagged in the app's README under "Known gaps" — the UI here completes
  /// honestly (tells the caller sign-up succeeded) rather than pretending a
  /// session was established.
  Future<void> signUp({required String email, required String password, required String name}) async {
    final base = await ApiConfig.getBaseUrl();
    final response = await http
        .post(
          Uri.parse('$base/api/auth/sign-up/email'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email, 'password': password, 'name': name}),
        )
        .timeout(_networkTimeout);

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = (body['message'] as String?) ?? 'Sign-up failed.';
      throw ApiException(response.statusCode, 'SIGNUP_FAILED', message);
    }
  }

  Future<void> signOut() async {
    await ApiClient.instance.setToken(null);
  }

  Future<bool> get isSignedIn => ApiClient.instance.isSignedIn;
}

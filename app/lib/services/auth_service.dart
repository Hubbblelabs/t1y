import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'api_client.dart';

/// Result of [AuthService.checkEmailExists]. `status` is null when the
/// account doesn't exist; otherwise one of "PENDING", "ACTIVE", "INACTIVE",
/// "SUSPENDED" (see the backend's `UserStatus` enum).
class EmailCheckResult {
  final bool exists;
  final String? status;
  const EmailCheckResult({required this.exists, required this.status});
}

/// Better Auth's `sign-in/email` endpoint returns the bearer token in a
/// response header (`set-auth-token`) as well as in the JSON body's `token`
/// field — the mobile client reads the body field, which is simpler than
/// threading response headers through `http`'s API.
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const _networkTimeout = Duration(seconds: 15);

  /// Signs in and returns whether this account still carries a temporary
  /// (dummy) password — set on the backend when an admin activates a
  /// participant or bulk-imports one. When true, the caller must send the
  /// person straight to [changePassword] before anything else in the app.
  Future<bool> signIn({required String email, required String password}) async {
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
      // This account exists and the password is right, but the coordinator
      // hasn't accepted the enrolment yet (see admin's Participants →
      // Accept/Reject) — Better Auth reports this as "email not verified"
      // because activation is what verifies it. That backend wording would
      // read as a broken account to a parent, so it's replaced here.
      final code = body['code'] as String?;
      final message = code == 'EMAIL_NOT_VERIFIED'
          ? "Your status is yet to be updated by the admin. Thank you for your patience."
          : (body['message'] as String?) ?? 'Sign-in failed.';
      throw ApiException(response.statusCode, code ?? 'AUTH_FAILED', message);
    }

    final token = body['token'] as String?;
    if (token == null) {
      throw ApiException(response.statusCode, 'AUTH_FAILED', 'No session token was returned.');
    }
    await ApiClient.instance.setToken(token);

    final user = body['user'] as Map<String, dynamic>?;
    return (user?['mustChangePassword'] as bool?) ?? false;
  }

  /// Calls Better Auth's built-in `/change-password` endpoint. Requires the
  /// caller to already hold a session (the bearer token set by [signIn]).
  ///
  /// Better Auth itself doesn't know which password was the "dummy" one, so
  /// the "must differ from the temporary password" rule is enforced by the
  /// caller comparing [newPassword] to the password the person just typed to
  /// sign in, before this is ever called.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final base = await ApiConfig.getBaseUrl();
    final token = await ApiClient.instance.token;
    final response = await http
        .post(
          Uri.parse('$base/api/auth/change-password'),
          headers: {
            'Content-Type': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'currentPassword': currentPassword,
            'newPassword': newPassword,
            'revokeOtherSessions': true,
          }),
        )
        .timeout(_networkTimeout);

    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = (body['message'] as String?) ?? 'Could not change your password.';
      throw ApiException(response.statusCode, 'CHANGE_PASSWORD_FAILED', message);
    }

    // Revoking other sessions invalidates the token this request just used
    // too — Better Auth returns a fresh one for the still-open session.
    final newToken = body['token'] as String?;
    if (newToken != null) await ApiClient.instance.setToken(newToken);
  }

  /// Whether an account already exists for this email, and its status if so
  /// — decides whether the entry screen asks for a password (returning
  /// user, ACTIVE/INACTIVE), shows the "still awaiting the admin" message
  /// directly (PENDING — asking for a password would only fail with a
  /// confusing error), or starts the sign-up chat (no account yet).
  ///
  /// Backed by `GET /api/check-email` (see that route's doc for why this
  /// isn't the information leak it might look like).
  Future<EmailCheckResult> checkEmailExists(String email) async {
    final base = await ApiConfig.getBaseUrl();
    final uri = Uri.parse('$base/api/check-email').replace(
      queryParameters: {'email': email.trim()},
    );
    final response = await http.get(uri).timeout(_networkTimeout);

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = (body['message'] as String?) ?? 'Could not check this email.';
      throw ApiException(response.statusCode, 'CHECK_EMAIL_FAILED', message);
    }

    final data = body['data'] as Map<String, dynamic>;
    return EmailCheckResult(
      exists: data['exists'] as bool,
      status: data['status'] as String?,
    );
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

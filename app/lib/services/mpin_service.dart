import 'api_client.dart';

class MpinStatus {
  final bool isSet;
  final DateTime? lockedUntil;
  final int attemptsRemaining;

  const MpinStatus({
    required this.isSet,
    required this.lockedUntil,
    required this.attemptsRemaining,
  });

  bool get isLocked =>
      lockedUntil != null && lockedUntil!.isAfter(DateTime.now());

  factory MpinStatus.fromJson(Map<String, dynamic> json) => MpinStatus(
    isSet: json['isSet'] as bool? ?? false,
    lockedUntil: json['lockedUntil'] == null
        ? null
        : DateTime.tryParse(json['lockedUntil'] as String),
    attemptsRemaining: json['attemptsRemaining'] as int? ?? 0,
  );
}

class MpinVerifyResult {
  final bool ok;
  final int attemptsRemaining;
  final DateTime? lockedUntil;

  const MpinVerifyResult({
    required this.ok,
    required this.attemptsRemaining,
    required this.lockedUntil,
  });

  factory MpinVerifyResult.fromJson(Map<String, dynamic> json) =>
      MpinVerifyResult(
        ok: json['ok'] as bool? ?? false,
        attemptsRemaining: json['attemptsRemaining'] as int? ?? 0,
        lockedUntil: json['lockedUntil'] == null
            ? null
            : DateTime.tryParse(json['lockedUntil'] as String),
      );
}

/// The parent's MPIN, which gates glucose entry so a child holding the phone
/// can't type readings into their own record.
///
/// Verification is server-side on every attempt — the PIN is never cached on
/// the device and never compared locally, so failed attempts count towards
/// the same lock-out no matter how many times the app is restarted.
class MpinService {
  MpinService._();
  static final MpinService instance = MpinService._();

  /// Whether a PIN exists yet, and whether it's currently locked out.
  /// Cached for the lifetime of one screen only — never held across the app,
  /// since the answer changes the moment the parent sets one.
  Future<MpinStatus> status() async {
    final data = await ApiClient.instance.get('/api/mpin');
    return MpinStatus.fromJson(data['data'] as Map<String, dynamic>);
  }

  /// Sets the household's first PIN. Fails if one already exists — changing
  /// it goes through [reset], which requires the account password.
  Future<void> setPin(String pin) async {
    await ApiClient.instance.post('/api/mpin', body: {'pin': pin});
  }

  /// Checks a PIN. A wrong PIN comes back as `ok: false` with the attempts
  /// remaining rather than as an error — mistyping is ordinary, and the UI
  /// needs the count to warn before the lock-out lands.
  Future<MpinVerifyResult> verify(String pin) async {
    final data = await ApiClient.instance.post(
      '/api/mpin/verify',
      body: {'pin': pin},
    );
    return MpinVerifyResult.fromJson(data['data'] as Map<String, dynamic>);
  }

  /// The "forgot your PIN" path: the account password is the only thing that
  /// can replace a PIN.
  Future<void> reset({required String password, required String newPin}) async {
    await ApiClient.instance.post(
      '/api/mpin/reset',
      body: {'password': password, 'pin': newPin},
    );
  }
}

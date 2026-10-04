import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_client.dart';

/// One emergency contact a coordinator has chosen to show this child.
class SosContact {
  final String id;
  final String name;
  final String phone;

  /// Free text — "Doctor", "Nurse", whatever the coordinator typed.
  final String label;

  const SosContact({
    required this.id,
    required this.name,
    required this.phone,
    required this.label,
  });

  factory SosContact.fromJson(Map<String, dynamic> json) => SosContact(
    id: json['id'] as String,
    name: json['name'] as String,
    phone: json['phone'] as String,
    label: json['label'] as String,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'phone': phone,
    'label': label,
  };

  /// The number with spaces, dashes and brackets removed — what the dialler
  /// wants. A leading `+` is kept.
  String get dialable => phone.replaceAll(RegExp(r'[^0-9+]'), '');
}

/// Emergency contacts.
///
/// The last list that loaded is kept on the phone: an emergency is exactly when
/// the signal may be poor, so the screen must still show who to call.
class SosService {
  SosService._();
  static final SosService instance = SosService._();

  static const _cacheKey = 'sos_contacts_cache';

  /// Fresh from the server when it can be reached, otherwise the saved copy.
  Future<List<SosContact>> load() async {
    try {
      final data = await ApiClient.instance
          .get('/api/sos-contacts')
          .timeout(const Duration(seconds: 8));
      final contacts = [
        for (final row in data['data'] as List<dynamic>)
          SosContact.fromJson(row as Map<String, dynamic>),
      ];
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _cacheKey,
        jsonEncode([for (final c in contacts) c.toJson()]),
      );
      return contacts;
    } catch (_) {
      return cached();
    }
  }

  Future<List<SosContact>> cached() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_cacheKey);
    if (raw == null) return const [];
    try {
      return [
        for (final row in jsonDecode(raw) as List<dynamic>)
          SosContact.fromJson(row as Map<String, dynamic>),
      ];
    } catch (_) {
      return const [];
    }
  }

  /// Opens the phone's dialler with the number filled in, ready to call.
  /// False when this device cannot place calls.
  Future<bool> dial(SosContact contact) =>
      launchUrl(Uri(scheme: 'tel', path: contact.dialable));
}

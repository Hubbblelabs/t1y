import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'calculator_runner.dart';

/// A value filled in from the child's own records, with when it was recorded.
class RecordedValue {
  final double? value;

  /// When the underlying record was made. Null for a profile detail, which has
  /// no moment of its own.
  final DateTime? recordedAt;

  /// Why there is no value, worded for a parent — shown in place of one.
  final String? missingReason;

  const RecordedValue({this.value, this.recordedAt, this.missingReason});

  factory RecordedValue.fromJson(Map<String, dynamic> json) => RecordedValue(
    value: (json['value'] as num?)?.toDouble(),
    recordedAt: json['recordedAt'] == null
        ? null
        : DateTime.tryParse(json['recordedAt'] as String)?.toLocal(),
    missingReason: json['missingReason'] as String?,
  );
}

/// The calculators the dashboard has switched on, and the child's own numbers
/// to fill them in from.
///
/// The definitions are cached on the phone: a parent working out a mealtime
/// dose in a kitchen with no signal is the normal case, not an edge case, and
/// [runCalculator] does the arithmetic locally. Only pre-filling from records
/// needs the network, and when that is unavailable the parent simply types the
/// number — the calculator is never held up by it.
class CalculatorService {
  CalculatorService._();
  static final CalculatorService instance = CalculatorService._();

  /// Lets a test supply the child's records without a server.
  @visibleForTesting
  Future<Map<String, RecordedValue>> Function(List<String> keys)?
  valuesForOverride;

  static const _cacheKey = 'calculators_cache';
  static const _fetchTimeout = Duration(seconds: 8);

  /// Every calculator currently switched on, in the order the dashboard set.
  ///
  /// Cache-first, refreshed in the background, so opening the screen is
  /// instant. A calculator hidden in the dashboard therefore disappears from a
  /// phone the next time it is opened after that refresh, not the instant it is
  /// hidden — the same trade the Help Book makes.
  Future<List<Calculator>> list() async {
    final cached = await _readCache();
    if (cached != null) {
      unawaited(_fetch());
      return cached;
    }
    return await _fetch() ?? const [];
  }

  /// The child's own values for the given catalogue keys, keyed by catalogue
  /// key. Never throws: on any failure it returns nothing, and the calculator
  /// asks the parent to type the numbers instead.
  Future<Map<String, RecordedValue>> valuesFor(List<String> keys) async {
    if (keys.isEmpty) return const {};
    final override = valuesForOverride;
    if (override != null) return override(keys);
    try {
      final data = await ApiClient.instance
          .get('/api/calculators/values', query: {'keys': keys.join(',')})
          .timeout(_fetchTimeout);
      final rows = data['data'] as List<dynamic>;
      return {
        for (final row in rows)
          (row as Map<String, dynamic>)['key'] as String:
              RecordedValue.fromJson(row),
      };
    } catch (_) {
      return const {};
    }
  }

  Future<List<Calculator>?> _fetch() async {
    try {
      final data = await ApiClient.instance
          .get('/api/calculators')
          .timeout(_fetchTimeout);
      final rows = data['data'] as List<dynamic>;
      final calculators = [
        for (final row in rows)
          Calculator.fromJson(row as Map<String, dynamic>),
      ];

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, jsonEncode(rows));
      return calculators;
    } catch (_) {
      return null;
    }
  }

  Future<List<Calculator>?> _readCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_cacheKey);
      if (raw == null) return null;
      return [
        for (final row in jsonDecode(raw) as List<dynamic>)
          Calculator.fromJson(row as Map<String, dynamic>),
      ];
    } catch (_) {
      return null;
    }
  }

  /// Forgets the cached list, e.g. on sign-out, so the next child on a shared
  /// phone does not briefly see the previous one's.
  Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey);
  }
}

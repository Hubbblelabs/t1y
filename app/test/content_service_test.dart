import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:t1dpe/models/topic.dart';
import 'package:t1dpe/services/content_service.dart';

void main() {
  final topic = Topic(
    id: '1',
    slug: 'insulin-basics',
    locale: 'EN',
    title: 'Insulin basics',
    description: null,
    category: 'INSULIN',
    body: '',
    isFallback: false,
  );

  test('treats EN and en as the same language', () {
    expect(ContentService.normaliseLocale('EN'), 'en');
    expect(ContentService.normaliseLocale('ta'), 'ta');
    expect(ContentService.normaliseLocale(' TA '), 'ta');
  });

  /// The bug: a topic screen passes `topic.locale` ("EN"), the server only
  /// accepts "en", and the cache was keyed by whatever was passed — so the
  /// content sat under one key and was looked for under another.
  test('finds the cached content whichever way the locale is spelt', () async {
    SharedPreferences.setMockInitialValues({
      'content_bundle_en': jsonEncode([topic.toJson()]),
    });

    final upper = await ContentService.instance.getTopics('EN');
    final lower = await ContentService.instance.getTopics('en');

    expect(upper.single.slug, 'insulin-basics');
    expect(lower.single.slug, 'insulin-basics');
  });

  test('a failed background refresh is swallowed, not raised', () async {
    SharedPreferences.setMockInitialValues({
      'content_bundle_en': jsonEncode([topic.toJson()]),
    });

    // There is no server here, so the background refresh fails. The caller has
    // its cached copy and must neither see nor be crashed by that.
    final topics = await ContentService.instance.getTopics('EN');
    await Future<void>.delayed(const Duration(milliseconds: 50));

    expect(topics, hasLength(1));
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';

import '../../config/api_config.dart';
import '../../models/topic.dart';

/// Renders the sanitised HTML body from the backend (see
/// api/lib/utils/sanitize-core.ts's allowlist) — the same bytes the admin
/// preview shows, so what an editor sees is what a participant gets.
class TopicDetailScreen extends StatefulWidget {
  final Topic topic;

  const TopicDetailScreen({super.key, required this.topic});

  @override
  State<TopicDetailScreen> createState() => _TopicDetailScreenState();
}

class _TopicDetailScreenState extends State<TopicDetailScreen> {
  String? _resolvedBody;

  @override
  void initState() {
    super.initState();
    _resolveImages();
  }

  /// The importer writes figures under /content/... on the API host —
  /// relative paths a browser resolves against its own origin, but flutter_html
  /// has no origin to resolve against, so they must be made absolute here.
  Future<void> _resolveImages() async {
    final base = await ApiConfig.getBaseUrl();
    final rewritten = widget.topic.body.replaceAll('src="/content/', 'src="$base/content/');
    if (mounted) setState(() => _resolvedBody = rewritten);
  }

  @override
  Widget build(BuildContext context) {
    final topic = widget.topic;
    return Scaffold(
      appBar: AppBar(title: Text(topic.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (topic.isFallback)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('A Tamil translation isn\'t published yet — showing English.'),
              ),
            if (_resolvedBody == null)
              const Center(child: CircularProgressIndicator())
            else
              Html(
                data: _resolvedBody!.isEmpty ? '<p><em>No content yet.</em></p>' : _resolvedBody!,
                style: {
                  'body': Style(margin: Margins.zero, padding: HtmlPaddings.zero),
                  'img': Style(width: Width(100, Unit.percent)),
                },
              ),
          ],
        ),
      ),
    );
  }
}

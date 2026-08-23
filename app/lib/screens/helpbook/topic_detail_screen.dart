import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';

import '../../config/api_config.dart';
import '../../l10n/strings.dart';
import '../../models/topic.dart';
import '../../services/content_service.dart';
import '../../services/progress_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/language_toggle.dart';
import '../../widgets/locale_aware.dart';

/// Renders the sanitised HTML body from the backend (see
/// api/lib/utils/sanitize-core.ts's allowlist) — the same bytes the admin
/// preview shows, so what an editor sees is what a participant gets.
///
/// The language toggle lives here too: a parent reading a topic in English
/// who wants the Tamil version shouldn't have to back out to the list to
/// get it. Switching swaps this same topic to the other locale in place.
class TopicDetailScreen extends StatefulWidget {
  final Topic topic;

  const TopicDetailScreen({super.key, required this.topic});

  @override
  State<TopicDetailScreen> createState() => _TopicDetailScreenState();
}

class _TopicDetailScreenState extends State<TopicDetailScreen>
    with LocaleAware<TopicDetailScreen> {
  late Topic _topic;
  String? _resolvedBody;
  String? _baseUrl;
  late DateTime _openedAt;
  bool _markedRead = false;
  bool _switching = false;

  @override
  void initState() {
    super.initState();
    _topic = widget.topic;
    _openedAt = DateTime.now();
    _init();
  }

  Future<void> _init() async {
    _baseUrl = await ApiConfig.getBaseUrl();
    _applyBody();
    ProgressService.instance.recordTopicOpened(_topic.slug, _topic.locale);
    final read = await ProgressService.instance.readTopicSlugs();
    if (mounted) setState(() => _markedRead = read.contains(_topic.slug));
  }

  /// The importer writes figures under /content/... on the API host —
  /// relative paths a browser resolves against its own origin, but
  /// flutter_html has no origin to resolve against, so they must be made
  /// absolute here.
  void _applyBody() {
    final base = _baseUrl;
    final body = base == null
        ? _topic.body
        : _topic.body.replaceAll('src="/content/', 'src="$base/content/');
    if (mounted) setState(() => _resolvedBody = body);
  }

  /// Re-resolves *this* topic in the newly-selected language and swaps it in
  /// place, keeping the reader where they were instead of bouncing them out.
  @override
  Future<void> onLocaleChanged(String locale) async {
    setState(() => _switching = true);
    try {
      final topics = await ContentService.instance.getTopics(locale);
      final match = topics.where((t) => t.slug == _topic.slug).firstOrNull;
      if (match != null && mounted) {
        setState(() => _topic = match);
        _applyBody();
      }
    } finally {
      if (mounted) setState(() => _switching = false);
    }
  }

  Future<void> _toggleRead() async {
    if (_markedRead) return;
    await ProgressService.instance.recordTopicCompleted(
      _topic.slug,
      _topic.locale,
      secondsSpent: DateTime.now().difference(_openedAt).inSeconds,
    );
    if (!mounted) return;
    setState(() => _markedRead = true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(S.markedAsRead),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = _resolvedBody;
    final hasContent = body != null && body.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(_topic.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: const [LanguageToggle(), SizedBox(width: 12)],
      ),
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_topic.isFallback)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFB26A00).withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.translate, size: 16, color: Color(0xFFB26A00)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              S.tamilNotPublished,
                              style: const TextStyle(fontSize: 12.5, height: 1.35),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (_resolvedBody == null)
                    const Padding(
                      padding: EdgeInsets.only(top: 60),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (!hasContent)
                    Padding(
                      padding: const EdgeInsets.only(top: 60),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(
                              Icons.menu_book_outlined,
                              size: 44,
                              color: AppTheme.deep.withValues(alpha: 0.35),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              S.noContentYet,
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.black.withValues(alpha: 0.6),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    Html(
                      data: body,
                      style: {
                        'body': Style(margin: Margins.zero, padding: HtmlPaddings.zero),
                        'img': Style(width: Width(100, Unit.percent)),
                        'p': Style(fontSize: FontSize(15), lineHeight: LineHeight(1.6)),
                        'li': Style(fontSize: FontSize(15), lineHeight: LineHeight(1.6)),
                      },
                    ),
                ],
              ),
            ),
            if (_switching)
              Positioned.fill(
                child: ColoredBox(
                  color: Colors.white.withValues(alpha: 0.7),
                  child: const Center(child: CircularProgressIndicator()),
                ),
              ),
          ],
        ),
      ),
      // A fixed bar in the layout, not a floating button over the content —
      // it never overlaps the last lines of the article while scrolling.
      bottomNavigationBar: hasContent
          ? SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                child: _MarkReadButton(isRead: _markedRead, onPressed: _toggleRead),
              ),
            )
          : null,
    );
  }
}

/// Explicit completion control. Reading progress is also recorded implicitly,
/// but an explicit button gives the parent a clear sense of finishing a
/// topic — and makes their own progress legible rather than something the
/// app decided silently on their behalf.
class _MarkReadButton extends StatelessWidget {
  final bool isRead;
  final VoidCallback onPressed;

  const _MarkReadButton({required this.isRead, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton.icon(
        onPressed: isRead ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: isRead ? const Color(0xFF2E7D32) : AppTheme.deep,
          disabledBackgroundColor: const Color(0xFF2E7D32),
          disabledForegroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        icon: AnimatedSwitcher(
          duration: const Duration(milliseconds: 260),
          transitionBuilder: (child, animation) =>
              ScaleTransition(scale: animation, child: child),
          child: Icon(
            isRead ? Icons.check_circle : Icons.check_circle_outline,
            key: ValueKey(isRead),
          ),
        ),
        label: Text(isRead ? S.markedAsRead : S.markAsRead),
      ),
    );
  }
}

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
import '../../widgets/topic_card.dart' show categoryIcons;

final _paragraphStyle = {
  'p': Style(
    fontSize: FontSize(16),
    lineHeight: LineHeight(1.65),
    margin: Margins.zero,
  ),
  'li': Style(fontSize: FontSize(16), lineHeight: LineHeight(1.65)),
  'body': Style(margin: Margins.zero, padding: HtmlPaddings.zero),
};

/// Reading screen: the image stays put at the top while only the text below
/// it scrolls, and the image changes to match whichever paragraph has just
/// scrolled into view — never a static picture the text outgrows. A
/// horizontal bar under the image fills left-to-right with how far down
/// the article the reader actually is, not a step count.
///
/// The image and progress bar are driven by [ValueNotifier]s read through
/// [ValueListenableBuilder], not `setState` — a scroll listener fires on
/// every frame of a drag, and rebuilding this whole screen (every paragraph,
/// every `Html` widget) that often is what made scrolling feel slow. Only
/// those two small widgets rebuild; the scrolling content itself never does
/// because of scroll position changing.
///
/// No image ever sits inline in the text (see
/// api/scripts/split-content-blocks.ts — every `<img>` in the source became
/// a block's own picture, stripped out of the paragraph itself), and "mark
/// as read" sits inline after the last paragraph — never floating, never
/// pinned to the bottom of the screen throughout the read.
///
/// Falls back to the old single-flow rendering of `body` for a topic that
/// hasn't been migrated to `contentBlocks` yet — never blank just because
/// the block layout isn't there.
class TopicDetailScreen extends StatefulWidget {
  final Topic topic;

  const TopicDetailScreen({super.key, required this.topic});

  @override
  State<TopicDetailScreen> createState() => _TopicDetailScreenState();
}

class _TopicDetailScreenState extends State<TopicDetailScreen>
    with LocaleAware<TopicDetailScreen> {
  late Topic _topic;
  String? _baseUrl;
  late DateTime _openedAt;
  bool _markedRead = false;
  bool _switching = false;
  bool _loaded = false;

  final _scrollController = ScrollController();
  List<GlobalKey> _blockKeys = [];
  late final ValueNotifier<double> _progress = ValueNotifier(0);
  late final ValueNotifier<String?> _headerImage = ValueNotifier(null);

  /// Set the moment a header image URL fails to actually load. The image
  /// row disappears rather than showing a broken-picture placeholder — a
  /// topic with no picture (or a picture that can't be reached) reads as a
  /// text-only topic, not as a topic missing something.
  late final ValueNotifier<bool> _headerImageFailed = ValueNotifier(false);

  /// The full topic list in the current locale, used only to work out what
  /// "previous"/"next" mean from here — fetched once and cache-first (the
  /// reader always arrived from this same list, so it's already on disk).
  List<Topic> _siblings = [];

  int _currentBlockIndex = 0;
  double _lastScanPixels = -1000;

  /// Distance from the top of the scroll viewport a block's top edge must
  /// cross before it counts as "the one being read" — keeps the swap tied
  /// to what's actually settled near the top of the reading area rather
  /// than the literal top pixel.
  static const _revealLine = 24.0;

  /// Re-scanning for the current block on every pixel of scroll is the
  /// other half of what made this feel slow — skip it until the reader has
  /// actually moved a few pixels since the last check.
  static const _scanThresholdPx = 12.0;

  @override
  void initState() {
    super.initState();
    _topic = widget.topic;
    _openedAt = DateTime.now();
    _blockKeys = List.generate(_topic.contentBlocks.length, (_) => GlobalKey());
    _scrollController.addListener(_onScroll);
    _init();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _progress.dispose();
    _headerImage.dispose();
    _headerImageFailed.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    _baseUrl = await ApiConfig.getBaseUrl();
    if (_topic.contentBlocks.isNotEmpty) {
      _headerImage.value = _absolute(_topic.contentBlocks.first.imageUrl);
    } else if (_topic.thumbnailUrl != null) {
      _headerImage.value = _absolute(_topic.thumbnailUrl!);
    }
    _headerImageFailed.value = false;
    if (mounted) setState(() => _loaded = true);
    ProgressService.instance.recordTopicOpened(_topic.slug, _topic.locale);
    final read = await ProgressService.instance.readTopicSlugs();
    if (mounted) setState(() => _markedRead = read.contains(_topic.slug));
    final siblings = await ContentService.instance.getTopics(_topic.locale);
    if (mounted) setState(() => _siblings = siblings);
  }

  /// Opens the previous/next topic in place. Wraps around — next from the
  /// last topic goes to the first, previous from the first goes to the last
  /// — so the reader can keep going without ever hitting a dead end.
  Future<void> _goToSibling(int step) async {
    if (_siblings.length < 2) return;
    final index = _siblings.indexWhere((t) => t.slug == _topic.slug);
    if (index == -1) return;
    final target = _siblings[(index + step) % _siblings.length];

    if (!mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => TopicDetailScreen(topic: target)),
    );
  }

  /// The importer writes figures under /content/... on the API host —
  /// relative paths a browser resolves against its own origin, but
  /// flutter_html/Image.network have no origin to resolve against, so they
  /// must be made absolute here.
  String _absolute(String url) {
    final base = _baseUrl;
    if (base == null || url.startsWith('http')) return url;
    return url.startsWith('/content/') ? '$base$url' : url;
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;

    _progress.value = position.maxScrollExtent <= 0
        ? 1.0
        : (position.pixels / position.maxScrollExtent).clamp(0.0, 1.0);

    if (_topic.contentBlocks.isEmpty) return;
    if ((position.pixels - _lastScanPixels).abs() < _scanThresholdPx) return;
    _lastScanPixels = position.pixels;
    _scanForCurrentBlock();
  }

  /// Walks outward from the current index instead of scanning every block —
  /// the reader only ever moves a handful of blocks between scans once
  /// [_scanThresholdPx] is in effect, so this is nearly always O(1) rather
  /// than O(block count), which matters once a topic has hundreds of them.
  void _scanForCurrentBlock() {
    int? bestIndex;
    double bestDistance = double.infinity;

    void check(int i) {
      if (i < 0 || i >= _blockKeys.length) return;
      final ctx = _blockKeys[i].currentContext;
      if (ctx == null) return;
      final box = ctx.findRenderObject() as RenderBox?;
      if (box == null || !box.attached) return;
      final top = box.localToGlobal(Offset.zero).dy;
      final distance = top - _revealLine;
      // The block whose top has most recently crossed the reveal line —
      // i.e. the smallest non-negative distance above it.
      if (distance <= 0 && -distance < bestDistance) {
        bestDistance = -distance;
        bestIndex = i;
      }
    }

    const window = 6;
    for (var offset = 0; offset <= window; offset++) {
      check(_currentBlockIndex + offset);
      if (offset > 0) check(_currentBlockIndex - offset);
    }
    // Outside the fast window (e.g. a fling, or jumping languages) — fall
    // back to a full scan once rather than never finding the right block.
    if (bestIndex == null) {
      for (var i = 0; i < _blockKeys.length; i++) {
        check(i);
      }
    }

    if (bestIndex != null && bestIndex != _currentBlockIndex) {
      _currentBlockIndex = bestIndex!;
      _headerImage.value = _absolute(_topic.contentBlocks[bestIndex!].imageUrl);
      _headerImageFailed.value = false;
    }
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
        setState(() {
          _topic = match;
          _blockKeys = List.generate(
            _topic.contentBlocks.length,
            (_) => GlobalKey(),
          );
          _currentBlockIndex = 0;
          _lastScanPixels = -1000;
        });
        _progress.value = 0;
        _headerImage.value = _topic.contentBlocks.isNotEmpty
            ? _absolute(_topic.contentBlocks.first.imageUrl)
            : (_topic.thumbnailUrl != null
                  ? _absolute(_topic.thumbnailUrl!)
                  : null);
        _headerImageFailed.value = false;
        if (_scrollController.hasClients) _scrollController.jumpTo(0);
      }
      if (mounted) setState(() => _siblings = topics);
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
    final blocks = _topic.contentBlocks;
    final hasBlocks = blocks.isNotEmpty;
    final hasLegacyBody = _topic.body.trim().isNotEmpty;
    final hasContent = hasBlocks || hasLegacyBody;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(_topic.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: const [LanguageToggle(), SizedBox(width: 12)],
      ),
      // The AppBar already accounts for the status bar — a SafeArea here
      // would add that inset a second time, which read as unexplained empty
      // space above the image.
      body: SafeArea(
        top: false,
        bottom: false,
        child: Stack(
          children: [
            if (!_loaded)
              const Center(child: CircularProgressIndicator())
            else if (!hasContent)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
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
              )
            else
              Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: _CategoryChip(category: _topic.category),
                    ),
                  ),
                  if (hasBlocks)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: ValueListenableBuilder<double>(
                          valueListenable: _progress,
                          builder: (context, value, _) =>
                              LinearProgressIndicator(
                                value: value,
                                minHeight: 4,
                                backgroundColor: AppTheme.primary.withValues(
                                  alpha: 0.12,
                                ),
                                valueColor: const AlwaysStoppedAnimation(
                                  AppTheme.primary,
                                ),
                              ),
                        ),
                      ),
                    ),
                  ValueListenableBuilder<String?>(
                    valueListenable: _headerImage,
                    builder: (context, headerImage, _) {
                      if (headerImage == null) return const SizedBox.shrink();
                      return ValueListenableBuilder<bool>(
                        valueListenable: _headerImageFailed,
                        builder: (context, failed, _) {
                          // No image URL, or one that didn't actually load —
                          // either way the whole row goes away rather than
                          // leaving a broken-picture placeholder in its place.
                          if (failed) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                            child: Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: AppTheme.deep.withValues(alpha: 0.08),
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppTheme.deep.withValues(
                                      alpha: 0.08,
                                    ),
                                    blurRadius: 16,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: AspectRatio(
                                // 3:2 — the fixed image ratio used across the Help Book.
                                aspectRatio: 3 / 2,
                                child: AnimatedSwitcher(
                                  duration: const Duration(milliseconds: 320),
                                  child: Image.network(
                                    headerImage,
                                    key: ValueKey(headerImage),
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) {
                                      // Reporting the failure belongs to the
                                      // next frame, not to this build.
                                      WidgetsBinding.instance
                                          .addPostFrameCallback((_) {
                                            if (mounted &&
                                                _headerImage.value ==
                                                    headerImage) {
                                              _headerImageFailed.value = true;
                                            }
                                          });
                                      return const SizedBox.shrink();
                                    },
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                  if (_topic.isFallback)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFB26A00).withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.translate,
                            size: 16,
                            color: Color(0xFFB26A00),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              S.tamilNotPublished,
                              style: const TextStyle(
                                fontSize: 12.5,
                                height: 1.35,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: _scrollController,
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (hasBlocks)
                            for (var i = 0; i < blocks.length; i++)
                              Container(
                                key: _blockKeys[i],
                                padding: const EdgeInsets.only(bottom: 14),
                                child: Html(
                                  data: blocks[i].paragraph,
                                  style: _paragraphStyle,
                                ),
                              )
                          else
                            Html(
                              data: _topic.body.replaceAll(
                                'src="/content/',
                                'src="${_baseUrl ?? ''}/content/',
                              ),
                              style: {
                                ..._paragraphStyle,
                                'img': Style(width: Width(100, Unit.percent)),
                              },
                            ),
                          const SizedBox(height: 14),
                          // Inline, at the end of the content — not a
                          // floating button and not pinned to the bottom of
                          // the screen throughout the read.
                          _MarkReadButton(
                            isRead: _markedRead,
                            onPressed: _toggleRead,
                          ),
                          if (_siblings.length > 1) ...[
                            const SizedBox(height: 12),
                            _TopicNavRow(
                              onPrevious: () => _goToSibling(-1),
                              onNext: () => _goToSibling(1),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
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
    );
  }
}

/// The same blue category badge shown on the Help Book list cards
/// (icon + label, e.g. "Insulin"), placed here below the AppBar and above
/// the header image rather than tucked into the scrolling content.
class _CategoryChip extends StatelessWidget {
  final String category;

  const _CategoryChip({required this.category});

  static String _label(String category) {
    final words = category.split('_');
    return words
        .map((w) => w.isEmpty ? w : w[0] + w.substring(1).toLowerCase())
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final icon = categoryIcons[category] ?? Icons.article_outlined;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppTheme.primary),
          const SizedBox(width: 5),
          Text(
            _label(category),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppTheme.primary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Previous/next between topics, wrapping around at either end (see
/// [_TopicDetailScreenState._goToSibling]) so there's always somewhere to go
/// next — the last topic's "Next" opens the first, and the first topic's
/// "Previous" opens the last.
class _TopicNavRow extends StatelessWidget {
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  const _TopicNavRow({required this.onPrevious, required this.onNext});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: onPrevious,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.deep,
              side: const BorderSide(color: AppTheme.primary, width: 1.4),
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            icon: const Icon(Icons.arrow_back, size: 18),
            label: Text(S.previousTopic),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton.icon(
            onPressed: onNext,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.primary,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            label: Text(S.nextTopic),
            icon: const Icon(Icons.arrow_forward, size: 18),
          ),
        ),
      ],
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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
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

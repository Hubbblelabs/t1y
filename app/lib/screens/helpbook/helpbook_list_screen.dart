import 'package:flutter/material.dart';

import '../../config/api_config.dart';
import '../../models/topic.dart';
import '../../l10n/strings.dart';
import '../../providers/app_state.dart';
import '../../services/content_service.dart';
import '../../services/progress_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_header.dart';
import '../../widgets/locale_aware.dart';
import '../../widgets/topic_card.dart'
    show TopicCard, categoryIcons, categoryName;
import 'topic_detail_screen.dart';

class HelpBookListScreen extends StatefulWidget {
  const HelpBookListScreen({super.key});

  @override
  State<HelpBookListScreen> createState() => _HelpBookListScreenState();
}

class _HelpBookListScreenState extends State<HelpBookListScreen>
    with LocaleAware<HelpBookListScreen> {
  late Future<List<Topic>> _future;
  String? _baseUrl;
  Set<String> _readSlugs = {};

  /// Tapped category icon, filtering the list below — null shows everything.
  /// Tapping the same icon again clears it back to null.
  String? _selectedCategory;

  @override
  void initState() {
    super.initState();
    _future = ContentService.instance.getTopics(loadedLocale);
    ApiConfig.getBaseUrl().then((url) {
      if (mounted) setState(() => _baseUrl = url);
    });
    _loadProgress();
  }

  @override
  void onLocaleChanged(String locale) {
    setState(() {
      _future = ContentService.instance.getTopics(locale, forceRefresh: true);
    });
  }

  Future<void> _loadProgress() async {
    final read = await ProgressService.instance.readTopicSlugs();
    if (mounted) setState(() => _readSlugs = read);
  }

  Future<void> _refresh() async {
    setState(() {
      _future = ContentService.instance.getTopics(
        AppState.instance.locale,
        forceRefresh: true,
      );
    });
    await _future;
    await _loadProgress();
  }

  Future<void> _openTopic(Topic topic) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => TopicDetailScreen(topic: topic)));
    // Reading a topic marks it complete; reflect that on return.
    await _loadProgress();
  }

  void _selectCategory(String category) {
    setState(() {
      _selectedCategory = _selectedCategory == category ? null : category;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(title: S.helpBook),
      body: Column(
        children: [
          // Pinned above the list, not scrolled away with it — a slim status
          // strip rather than the tall card that used to open the list.
          FutureBuilder<List<Topic>>(
            future: _future,
            builder: (context, snapshot) {
              final topics = snapshot.data ?? [];
              if (topics.isEmpty) return const SizedBox.shrink();
              final readCount = topics
                  .where((t) => _readSlugs.contains(t.slug))
                  .length;
              // Distinct categories actually published — not every
              // `categoryIcons` entry, which would show an icon for a
              // category with nothing in it yet.
              final categories = {for (final t in topics) t.category}.toList();
              return Column(
                children: [
                  _ProgressBanner(read: readCount, total: topics.length),
                  _CategoryIconRow(
                    categories: categories,
                    selected: _selectedCategory,
                    onSelect: _selectCategory,
                  ),
                ],
              );
            },
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: FutureBuilder<List<Topic>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return ListView(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            children: [
                              const SizedBox(height: 40),
                              Icon(
                                Icons.cloud_off,
                                size: 48,
                                color: AppTheme.deep.withValues(alpha: 0.4),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                '${S.couldNotLoad}\n${snapshot.error}',
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 12),
                              OutlinedButton(
                                onPressed: _refresh,
                                child: Text(S.tryAgain),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  }

                  final allTopics = snapshot.data ?? [];
                  if (allTopics.isEmpty) {
                    return ListView(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(24),
                          child: Center(child: Text(S.noTopicsYet)),
                        ),
                      ],
                    );
                  }

                  final category = _selectedCategory;
                  final topics = category == null
                      ? allTopics
                      : allTopics.where((t) => t.category == category).toList();

                  return ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: topics.length,
                    itemBuilder: (context, index) {
                      final topic = topics[index];
                      return TopicCard(
                        topic: topic,
                        baseUrl: _baseUrl,
                        isRead: _readSlugs.contains(topic.slug),
                        onTap: () => _openTopic(topic),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressBanner extends StatelessWidget {
  final int read;
  final int total;

  const _ProgressBanner({required this.read, required this.total});

  @override
  Widget build(BuildContext context) {
    final fraction = total == 0 ? 0.0 : read / total;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.primary, AppTheme.deep],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Text(
            S.topicsRead(read, total),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(
                value: fraction,
                minHeight: 5,
                backgroundColor: Colors.white.withValues(alpha: 0.25),
                valueColor: const AlwaysStoppedAnimation(Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One icon per published category, sitting under the progress banner —
/// each behaves like a quick action: tap to jump straight to that part of
/// the Help Book, tap the same one again to see everything.
class _CategoryIconRow extends StatelessWidget {
  final List<String> categories;
  final String? selected;
  final ValueChanged<String> onSelect;

  const _CategoryIconRow({
    required this.categories,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    if (categories.length < 2) return const SizedBox.shrink();

    return SizedBox(
      height: 128,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final category = categories[index];
          return _CategoryIconTile(
            icon: categoryIcons[category] ?? Icons.article_outlined,
            label: _categoryLabel(category),
            selected: category == selected,
            onTap: () => onSelect(category),
          );
        },
      ),
    );
  }
}

String _categoryLabel(String category) => categoryName(category);

/// A single quick-action icon tile — dips slightly on press, same treatment
/// as the home screen's own quick-action tiles, so the two read as the same
/// kind of control.
class _CategoryIconTile extends StatefulWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CategoryIconTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  State<_CategoryIconTile> createState() => _CategoryIconTileState();
}

class _CategoryIconTileState extends State<_CategoryIconTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.93 : 1,
        duration: const Duration(milliseconds: 130),
        curve: Curves.easeOut,
        child: SizedBox(
          width: 78,
          // A fixed height, not just a fixed width: the label's natural line
          // height varies slightly by platform/font metrics, and that's what
          // was overflowing the row by a few pixels even with headroom in
          // the parent — pinning every piece of this tile's size removes
          // the guesswork entirely instead of padding around it.
          height: 108,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: widget.selected ? AppTheme.primary : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.deep.withValues(
                        alpha: widget.selected ? 0.14 : 0.08,
                      ),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(
                  widget.icon,
                  size: 24,
                  color: widget.selected ? Colors.white : AppTheme.primary,
                ),
              ),
              const SizedBox(height: 6),
              // Two lines, not an ellipsis: Tamil category names are longer
              // than their English ones and must still be readable in full.
              SizedBox(
                height: 34,
                child: Text(
                  widget.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.visible,
                  softWrap: true,
                  style: TextStyle(
                    fontSize: 10.5,
                    height: 1.2,
                    fontWeight: FontWeight.w600,
                    color: widget.selected
                        ? AppTheme.deep
                        : AppTheme.inkSoft,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

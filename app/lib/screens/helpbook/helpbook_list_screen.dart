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
import '../../widgets/topic_card.dart';
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
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => TopicDetailScreen(topic: topic)),
    );
    // Reading a topic marks it complete; reflect that on return.
    await _loadProgress();
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
              final readCount = topics.where((t) => _readSlugs.contains(t.slug)).length;
              return _ProgressBanner(read: readCount, total: topics.length);
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

                  final topics = snapshot.data ?? [];
                  if (topics.isEmpty) {
                    return ListView(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(24),
                          child: Center(child: Text(S.noTopicsYet)),
                        ),
                      ],
                    );
                  }

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

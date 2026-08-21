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
      body: RefreshIndicator(
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

            final readCount = topics.where((t) => _readSlugs.contains(t.slug)).length;

            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: topics.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return _ProgressBanner(read: readCount, total: topics.length);
                }
                final topic = topics[index - 1];
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
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.primary, AppTheme.deep],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            S.yourLearning,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            S.topicsRead(read, total),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 7,
              backgroundColor: Colors.white.withValues(alpha: 0.25),
              valueColor: const AlwaysStoppedAnimation(Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../models/topic.dart';
import '../../providers/app_state.dart';
import '../../services/content_service.dart';
import '../../widgets/app_header.dart';
import 'topic_detail_screen.dart';

const _categoryIcons = <String, IconData>{
  'INSULIN': Icons.vaccines_outlined,
  'GLUCOSE_MANAGEMENT': Icons.monitor_heart_outlined,
  'HYPOGLYCAEMIA': Icons.warning_amber_outlined,
  'NUTRITION': Icons.restaurant_outlined,
  'EXERCISE': Icons.fitness_center_outlined,
  'SCHOOL_MANAGEMENT': Icons.school_outlined,
  'TRAVEL': Icons.flight_takeoff_outlined,
  'DIABAG': Icons.medical_services_outlined,
  'GENERAL_WELLNESS': Icons.fact_check_outlined,
};

class HelpBookListScreen extends StatefulWidget {
  const HelpBookListScreen({super.key});

  @override
  State<HelpBookListScreen> createState() => _HelpBookListScreenState();
}

class _HelpBookListScreenState extends State<HelpBookListScreen> {
  late Future<List<Topic>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = ContentService.instance.getTopics(AppState.instance.locale);
  }

  Future<void> _refresh() async {
    setState(() {
      _future = ContentService.instance.getTopics(AppState.instance.locale, forceRefresh: true);
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppHeader(title: 'Help Book'),
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
                        const Icon(Icons.cloud_off, size: 48),
                        const SizedBox(height: 12),
                        Text('Could not load content.\n${snapshot.error}', textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _refresh, child: const Text('Try again')),
                      ],
                    ),
                  ),
                ],
              );
            }

            final topics = snapshot.data ?? [];
            if (topics.isEmpty) {
              return ListView(
                children: const [
                  Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('No topics published yet.')),
                  ),
                ],
              );
            }

            return GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.1,
              ),
              itemCount: topics.length,
              itemBuilder: (context, index) {
                final topic = topics[index];
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => TopicDetailScreen(topic: topic)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            _categoryIcons[topic.category] ?? Icons.article_outlined,
                            size: 32,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          const Spacer(),
                          Text(
                            topic.title,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          if (topic.isFallback)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                'English only',
                                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: Theme.of(context).colorScheme.outline,
                                    ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

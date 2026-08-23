import 'package:flutter/material.dart';

import '../models/topic.dart';
import '../theme/app_theme.dart';

/// Per-category artwork for topics whose source document has no figures
/// (insulin-pump, exercise, school-travel), and as the loading/error
/// placeholder behind every thumbnail.
const categoryIcons = <String, IconData>{
  'INSULIN': Icons.vaccines_outlined,
  'GLUCOSE_MANAGEMENT': Icons.monitor_heart_outlined,
  'HYPOGLYCAEMIA': Icons.warning_amber_rounded,
  'NUTRITION': Icons.restaurant_outlined,
  'EXERCISE': Icons.directions_run_outlined,
  'SCHOOL_MANAGEMENT': Icons.school_outlined,
  'TRAVEL': Icons.flight_takeoff_outlined,
  'DIABAG': Icons.medical_services_outlined,
  'GENERAL_WELLNESS': Icons.fact_check_outlined,
};

/// Wide Help Book card — artwork on the left, details stacked on the right,
/// following the supplied listing-card reference.
class TopicCard extends StatelessWidget {
  final Topic topic;

  /// Absolute base URL of the API host. Thumbnails come back as site-relative
  /// paths (`/content/...`) which have no origin to resolve against on a
  /// device, so they are prefixed here.
  final String? baseUrl;
  final bool isRead;
  final VoidCallback onTap;

  const TopicCard({
    super.key,
    required this.topic,
    required this.baseUrl,
    required this.onTap,
    this.isRead = false,
  });

  @override
  Widget build(BuildContext context) {
    final icon = categoryIcons[topic.category] ?? Icons.article_outlined;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppTheme.deep.withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Thumbnail(topic: topic, baseUrl: baseUrl, fallbackIcon: icon),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      topic.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.deep,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (topic.description != null && topic.description!.isNotEmpty)
                      Text(
                        topic.description!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.35,
                          color: Colors.black.withValues(alpha: 0.6),
                        ),
                      ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Icon(icon, size: 14, color: AppTheme.primary),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            _categoryLabel(topic.category),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.primary,
                            ),
                          ),
                        ),
                        if (topic.readingTimeMinutes != null) ...[
                          const SizedBox(width: 10),
                          Icon(
                            Icons.schedule,
                            size: 13,
                            color: Colors.black.withValues(alpha: 0.4),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${topic.readingTimeMinutes} min',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: Colors.black.withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (topic.isFallback || isRead) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (isRead)
                            const _Pill(
                              label: 'Read',
                              icon: Icons.check_circle,
                              color: Color(0xFF2E7D32),
                            ),
                          if (topic.isFallback)
                            const _Pill(
                              label: 'English only',
                              icon: Icons.translate,
                              color: Color(0xFFB26A00),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _categoryLabel(String category) {
    final words = category.split('_');
    return words
        .map((w) => w.isEmpty ? w : w[0] + w.substring(1).toLowerCase())
        .join(' ');
  }
}

class _Thumbnail extends StatelessWidget {
  final Topic topic;
  final String? baseUrl;
  final IconData fallbackIcon;

  const _Thumbnail({
    required this.topic,
    required this.baseUrl,
    required this.fallbackIcon,
  });

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: 104,
      height: 104,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppTheme.lightest, AppTheme.accent.withValues(alpha: 0.7)],
        ),
      ),
      child: Icon(fallbackIcon, size: 38, color: AppTheme.deep.withValues(alpha: 0.55)),
    );

    final thumb = topic.thumbnailUrl;
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 104,
        height: 104,
        child: (thumb == null || baseUrl == null)
            ? placeholder
            : Image.network(
                thumb.startsWith('http') ? thumb : '$baseUrl$thumb',
                width: 104,
                height: 104,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => placeholder,
                loadingBuilder: (context, child, progress) =>
                    progress == null ? child : placeholder,
              ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;

  const _Pill({required this.label, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }
}

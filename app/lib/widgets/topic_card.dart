import 'package:flutter/material.dart';

import '../models/topic.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import '../l10n/strings.dart';

/// Bundled Help Book illustration shown whenever a topic or section picture
/// has no URL or fails to download.
const helpBookFallbackAsset = 'assets/images/helpbook_fallback.webp';

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

const _categoryTamil = <String, String>{
  'INSULIN': 'இன்சுலின்',
  'GLUCOSE_MANAGEMENT': 'குளுக்கோஸ் மேலாண்மை',
  'HYPOGLYCAEMIA': 'குறைந்த சர்க்கரை',
  'NUTRITION': 'ஊட்டச்சத்து',
  'EXERCISE': 'உடற்பயிற்சி',
  'SCHOOL_MANAGEMENT': 'பள்ளியில் மேலாண்மை',
  'TRAVEL': 'பயணம்',
  'DIABAG': 'நீரிழிவு பை',
  'GENERAL_WELLNESS': 'பொது நலம்',
};

/// A Help Book category's name in the app's current language. An unknown
/// category (one an administrator added) falls back to tidied English.
String categoryName(String category) {
  if (AppState.instance.locale == 'ta') {
    final ta = _categoryTamil[category];
    if (ta != null) return ta;
  }
  return category
      .split('_')
      .map((w) => w.isEmpty ? w : w[0] + w.substring(1).toLowerCase())
      .join(' ');
}

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
              // The gap belongs to the thumbnail itself (as trailing
              // padding), not to a fixed SizedBox next to it — a topic with
              // no real picture then takes the full row width instead of
              // leaving a blank gap where a placeholder box used to sit.
              _Thumbnail(topic: topic, baseUrl: baseUrl),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      topic.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.deep,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (topic.description != null &&
                        topic.description!.isNotEmpty)
                      Text(
                        topic.description!,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.35,
                          color: AppTheme.inkSoft,
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
                            color: AppTheme.inkSoft,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            S.minutesRead(topic.readingTimeMinutes!),
                            style: TextStyle(
                              fontSize: 11.5,
                              color: AppTheme.inkSoft,
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
                            _Pill(
                              label: S.readLabel,
                              icon: Icons.check_circle,
                              color: Color(0xFF2E7D32),
                            ),
                          if (topic.isFallback)
                            _Pill(
                              label: S.englishOnly,
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

  static String _categoryLabel(String category) => categoryName(category);
}

/// Every Help Book topic has a cover picture. While it downloads the slot
/// stays empty and the picture fades in once a frame is ready; if there is
/// no URL or the download fails, the bundled Help Book illustration stands
/// in so a card never shows a broken or blank picture.
class _Thumbnail extends StatefulWidget {
  final Topic topic;
  final String? baseUrl;

  const _Thumbnail({required this.topic, required this.baseUrl});

  // 3:2 — the same fixed image ratio used across the Help Book.
  static const _width = 114.0;
  static const _height = 76.0;

  @override
  State<_Thumbnail> createState() => _ThumbnailState();
}

class _ThumbnailState extends State<_Thumbnail> {
  bool _ready = false;
  bool _failed = false;

  String? get _resolvedUrl {
    final thumb = widget.topic.thumbnailUrl;
    if (thumb == null || thumb.isEmpty) return null;
    if (thumb.startsWith('http')) return thumb;
    final base = widget.baseUrl;
    return base == null ? null : '$base$thumb';
  }

  @override
  Widget build(BuildContext context) {
    final thumb = widget.topic.thumbnailUrl;
    final showFallback = _failed || thumb == null || thumb.isEmpty;
    // A site-relative URL can't load until the API base URL is known.
    final url = _resolvedUrl;

    return Padding(
      padding: const EdgeInsets.only(right: 14),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          width: _Thumbnail._width,
          height: _Thumbnail._height,
          child: showFallback
              ? Image.asset(helpBookFallbackAsset, fit: BoxFit.cover)
              : url == null
              ? const SizedBox.shrink()
              // Stays mounted while loading — its own frameBuilder is what
              // reports the picture ready; only opacity follows load state.
              : AnimatedOpacity(
                  opacity: _ready ? 1 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: Image.network(
                    url,
                    key: ValueKey(url),
                    width: _Thumbnail._width,
                    height: _Thumbnail._height,
                    fit: BoxFit.cover,
                    frameBuilder: (context, child, frame, _) {
                      if (frame != null && !_ready) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) setState(() => _ready = true);
                        });
                      }
                      return child;
                    },
                    errorBuilder: (_, _, _) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted) setState(() => _failed = true);
                      });
                      return const SizedBox.shrink();
                    },
                  ),
                ),
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
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

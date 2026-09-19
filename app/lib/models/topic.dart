/// One paragraph of a topic, paired with the image that illustrates it —
/// see api/scripts/split-content-blocks.ts for how these are derived from
/// the source content. `imageUrl` is never null once returned by the
/// backend: a paragraph with no image of its own inherits the nearest
/// preceding one, or the topic's thumbnail, or a generic fallback.
class ContentBlock {
  final String paragraph;
  final String imageUrl;

  ContentBlock({required this.paragraph, required this.imageUrl});

  factory ContentBlock.fromJson(Map<String, dynamic> json) => ContentBlock(
    paragraph: json['paragraph'] as String? ?? '',
    imageUrl: json['imageUrl'] as String? ?? '',
  );
}

class Topic {
  final String id;
  final String slug;
  final String locale;
  final String title;
  final String? description;
  final String category;
  final String body;
  final bool isFallback;

  /// First figure from the article, set by the content importer. Null for
  /// topics whose source document has no images — the Help Book card falls
  /// back to a per-category icon in that case.
  final String? thumbnailUrl;
  final int? readingTimeMinutes;

  /// Image-paired paragraphs for the reading screen's slideshow layout.
  /// Empty for a topic that hasn't been migrated to block layout yet — the
  /// reading screen falls back to rendering `body` as one flow in that case.
  final List<ContentBlock> contentBlocks;

  Topic({
    required this.id,
    required this.slug,
    required this.locale,
    required this.title,
    required this.description,
    required this.category,
    required this.body,
    required this.isFallback,
    this.thumbnailUrl,
    this.readingTimeMinutes,
    this.contentBlocks = const [],
  });

  factory Topic.fromJson(Map<String, dynamic> json) => Topic(
    id: json['id'] as String,
    slug: json['slug'] as String,
    locale: json['locale'] as String,
    title: json['title'] as String,
    description: json['description'] as String?,
    category: json['category'] as String,
    body: json['body'] as String? ?? '',
    isFallback: json['isFallback'] as bool? ?? false,
    thumbnailUrl: json['thumbnailUrl'] as String?,
    readingTimeMinutes: json['readingTimeMinutes'] as int?,
    contentBlocks:
        (json['contentBlocks'] as List<dynamic>?)
            ?.map((b) => ContentBlock.fromJson(b as Map<String, dynamic>))
            .toList() ??
        const [],
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'slug': slug,
    'locale': locale,
    'title': title,
    'description': description,
    'category': category,
    'body': body,
    'isFallback': isFallback,
    'thumbnailUrl': thumbnailUrl,
    'readingTimeMinutes': readingTimeMinutes,
    'contentBlocks': contentBlocks
        .map((b) => {'paragraph': b.paragraph, 'imageUrl': b.imageUrl})
        .toList(),
  };
}

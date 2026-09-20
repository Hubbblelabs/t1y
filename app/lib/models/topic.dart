/// What a single section of a topic shows.
enum BlockKind { text, image, video }

/// One section of a topic: some words, a picture, or a video, in the order
/// the author arranged them in the admin dashboard.
///
/// Older topics — the ones produced by api/scripts/split-content-blocks.ts
/// before sections could hold video — arrive without a `kind`, so it is
/// inferred from whichever media field is present. `imageUrl` may be empty
/// on those: a paragraph with no image of its own inherits the nearest
/// preceding one, or the topic's thumbnail, or a generic fallback.
class ContentBlock {
  final BlockKind kind;

  /// Optional sub-heading shown above this section's words.
  final String heading;
  final String paragraph;
  final String imageUrl;
  final String videoUrl;

  ContentBlock({
    required this.kind,
    required this.paragraph,
    required this.imageUrl,
    this.heading = '',
    this.videoUrl = '',
  });

  bool get hasVideo => videoUrl.isNotEmpty;
  bool get hasImage => imageUrl.isNotEmpty;

  static BlockKind _kindFrom(
    String? raw, {
    required String imageUrl,
    required String videoUrl,
  }) {
    switch (raw) {
      case 'TEXT':
        return BlockKind.text;
      case 'IMAGE':
        return BlockKind.image;
      case 'VIDEO':
        return BlockKind.video;
    }
    // No `kind` stored: this row predates block kinds.
    if (videoUrl.isNotEmpty) return BlockKind.video;
    if (imageUrl.isNotEmpty) return BlockKind.image;
    return BlockKind.text;
  }

  factory ContentBlock.fromJson(Map<String, dynamic> json) {
    final imageUrl = json['imageUrl'] as String? ?? '';
    final videoUrl = json['videoUrl'] as String? ?? '';
    return ContentBlock(
      kind: _kindFrom(
        json['kind'] as String?,
        imageUrl: imageUrl,
        videoUrl: videoUrl,
      ),
      heading: json['heading'] as String? ?? '',
      paragraph: json['paragraph'] as String? ?? '',
      imageUrl: imageUrl,
      videoUrl: videoUrl,
    );
  }

  Map<String, dynamic> toJson() => {
    'kind': kind.name.toUpperCase(),
    'heading': heading,
    'paragraph': paragraph,
    'imageUrl': imageUrl,
    'videoUrl': videoUrl,
  };
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
    'contentBlocks': contentBlocks.map((b) => b.toJson()).toList(),
  };
}

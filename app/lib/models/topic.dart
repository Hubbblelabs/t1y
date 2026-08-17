class Topic {
  final String id;
  final String slug;
  final String locale;
  final String title;
  final String? description;
  final String category;
  final String body;
  final bool isFallback;

  Topic({
    required this.id,
    required this.slug,
    required this.locale,
    required this.title,
    required this.description,
    required this.category,
    required this.body,
    required this.isFallback,
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
      };
}

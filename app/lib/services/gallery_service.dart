import '../providers/app_state.dart';
import 'api_client.dart';

/// One picture or video in the Gallery.
class GalleryItem {
  final String id;
  final bool isVideo;
  final String url;
  final String? thumbnailUrl;
  final String _title;
  final String? _titleTa;
  final String? _caption;
  final String? _captionTa;

  const GalleryItem({
    required this.id,
    required this.isVideo,
    required this.url,
    required this.thumbnailUrl,
    required String title,
    String? titleTa,
    String? caption,
    String? captionTa,
  }) : _title = title,
       _titleTa = titleTa,
       _caption = caption,
       _captionTa = captionTa;

  /// Tamil wording when the app is in Tamil and the team wrote it.
  String get title => AppState.instance.isTamil && (_titleTa ?? '').isNotEmpty
      ? _titleTa!
      : _title;

  String? get caption {
    final ta = AppState.instance.isTamil && (_captionTa ?? '').isNotEmpty;
    final text = ta ? _captionTa : _caption;
    return (text ?? '').isEmpty ? null : text;
  }

  /// What the grid shows: the picture itself, or a video's cover (if any).
  String? get still => isVideo ? thumbnailUrl : url;

  factory GalleryItem.fromJson(Map<String, dynamic> json) => GalleryItem(
    id: json['id'] as String,
    isVideo: json['kind'] == 'VIDEO',
    url: json['url'] as String,
    thumbnailUrl: json['thumbnailUrl'] as String?,
    title: json['title'] as String,
    titleTa: json['titleTa'] as String?,
    caption: json['caption'] as String?,
    captionTa: json['captionTa'] as String?,
  );
}

class GalleryService {
  GalleryService._();
  static final GalleryService instance = GalleryService._();

  Future<List<GalleryItem>> load() async {
    final data = await ApiClient.instance.get('/api/gallery');
    return [
      for (final row in data['data'] as List<dynamic>)
        GalleryItem.fromJson(row as Map<String, dynamic>),
    ];
  }
}

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../l10n/strings.dart';
import '../../services/gallery_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_loader.dart';

/// Pictures and videos the study team has added for every family.
class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  late Future<List<GalleryItem>> _items = GalleryService.instance.load();

  Future<void> _refresh() async {
    final next = GalleryService.instance.load();
    setState(() => _items = next);
    await next.catchError((_) => <GalleryItem>[]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(title: Text(S.gallery)),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<GalleryItem>>(
          future: _items,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: AppLoader()),
                ],
              );
            }
            final items = snapshot.data ?? const <GalleryItem>[];
            if (snapshot.hasError || items.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(28),
                children: [
                  const SizedBox(height: 60),
                  const Icon(
                    Icons.photo_library_outlined,
                    size: 44,
                    color: AppTheme.inkSoft,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    snapshot.hasError ? S.couldNotReach : S.galleryEmpty,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14.5,
                      height: 1.45,
                      color: AppTheme.inkSoft,
                    ),
                  ),
                ],
              );
            }
            return GridView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.92,
              ),
              itemCount: items.length,
              itemBuilder: (context, i) => _GalleryCard(item: items[i]),
            );
          },
        ),
      ),
    );
  }
}

class _GalleryCard extends StatelessWidget {
  final GalleryItem item;
  const _GalleryCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final still = item.still;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => _GalleryViewer(item: item))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (still != null)
                    Image.network(
                      still,
                      fit: BoxFit.cover,
                      loadingBuilder: (c, child, p) => p == null
                          ? child
                          : ColoredBox(
                              color: AppTheme.lightest,
                              child: const Center(
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                            ),
                      errorBuilder: (c, e, s) => const ColoredBox(
                        color: AppTheme.lightest,
                        child: Icon(
                          Icons.broken_image_outlined,
                          color: AppTheme.inkSoft,
                        ),
                      ),
                    )
                  else
                    const ColoredBox(color: AppTheme.lightest),
                  if (item.isVideo)
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 30,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Text(
                item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Full-screen picture (pinch to zoom) or video (tap to play/pause).
class _GalleryViewer extends StatefulWidget {
  final GalleryItem item;
  const _GalleryViewer({required this.item});

  @override
  State<_GalleryViewer> createState() => _GalleryViewerState();
}

class _GalleryViewerState extends State<_GalleryViewer> {
  VideoPlayerController? _controller;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    if (widget.item.isVideo) _loadVideo();
  }

  Future<void> _loadVideo() async {
    final uri = Uri.tryParse(widget.item.url);
    if (uri == null) return setState(() => _failed = true);
    final controller = VideoPlayerController.networkUrl(uri);
    try {
      await controller.initialize();
      if (!mounted) return controller.dispose();
      setState(() => _controller = controller);
      await controller.play();
    } catch (_) {
      await controller.dispose();
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final controller = _controller;

    Widget media;
    if (_failed) {
      media = Text(
        S.couldNotLoadMedia,
        style: const TextStyle(color: Colors.white70),
      );
    } else if (item.isVideo) {
      media = controller == null
          ? const CircularProgressIndicator(color: Colors.white)
          : AspectRatio(
              aspectRatio: controller.value.aspectRatio,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  VideoPlayer(controller),
                  ValueListenableBuilder<VideoPlayerValue>(
                    valueListenable: controller,
                    builder: (context, value, _) => GestureDetector(
                      onTap: () => value.isPlaying
                          ? controller.pause()
                          : controller.play(),
                      child: AnimatedOpacity(
                        duration: const Duration(milliseconds: 200),
                        opacity: value.isPlaying ? 0 : 1,
                        child: ColoredBox(
                          color: Colors.black.withValues(alpha: 0.28),
                          child: const Center(
                            child: Icon(
                              Icons.play_circle_fill,
                              size: 64,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: VideoProgressIndicator(
                      controller,
                      allowScrubbing: true,
                      colors: const VideoProgressColors(
                        playedColor: AppTheme.primary,
                      ),
                    ),
                  ),
                ],
              ),
            );
    } else {
      media = InteractiveViewer(
        maxScale: 5,
        child: Image.network(
          item.url,
          fit: BoxFit.contain,
          loadingBuilder: (c, child, p) => p == null
              ? child
              : const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                ),
          errorBuilder: (c, e, s) => Text(
            S.couldNotLoadMedia,
            style: const TextStyle(color: Colors.white70),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(item.title, style: const TextStyle(fontSize: 16)),
      ),
      body: Column(
        children: [
          Expanded(child: Center(child: media)),
          if (item.caption != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
              color: Colors.black,
              child: Text(
                item.caption!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

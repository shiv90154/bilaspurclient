import 'package:flutter/material.dart';

import '../core/config.dart';

/// A question's figure. Loads from the signed link the server put in the paper, shows a spinner while
/// it loads, a clear message if it cannot, and opens full screen (pinch to zoom) when tapped.
class QuestionImage extends StatelessWidget {
  const QuestionImage({super.key, required this.path, this.thumbSize});

  /// Server-relative signed link, e.g. `/api/files/<key>?exp=...`.
  final String path;

  /// Small fixed-size preview (photos of a written answer) instead of the full-width figure.
  final Size? thumbSize;

  @override
  Widget build(BuildContext context) {
    final url = absoluteUrl(path);
    final thumb = thumbSize;
    return Padding(
      padding: EdgeInsets.only(top: thumb == null ? 12 : 0),
      child: GestureDetector(
        onTap: () => showDialog<void>(
          context: context,
          builder: (dialogContext) => Dialog.fullscreen(
            backgroundColor: Colors.black,
            child: Stack(
              children: [
                Center(child: InteractiveViewer(maxScale: 5, child: Image.network(url))),
                Positioned(
                  top: 8,
                  right: 8,
                  child: SafeArea(
                    child: IconButton(
                      tooltip: 'Close',
                      color: Colors.white,
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(dialogContext),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: BoxConstraints(maxHeight: thumb?.height ?? 260),
            width: thumb?.width ?? double.infinity,
            height: thumb?.height,
            color: Colors.white,
            child: Image.network(
              url,
              fit: thumb == null ? BoxFit.contain : BoxFit.cover,
              loadingBuilder: (_, child, progress) => progress == null
                  ? child
                  : SizedBox(height: thumb?.height ?? 120, child: const Center(child: CircularProgressIndicator())),
              errorBuilder: (_, _, _) => thumb != null
                  ? const Center(child: Icon(Icons.broken_image_outlined))
                  : const SizedBox(
                      height: 80,
                      child: Center(child: Text('The picture could not be loaded. Check your internet and reopen the question.')),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

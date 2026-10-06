import 'package:flutter/material.dart';

import '../core/config.dart';

/// A question's figure. Loads from the signed link the server put in the paper, shows a spinner while
/// it loads, a clear message if it cannot, and opens full screen (pinch to zoom) when tapped.
class QuestionImage extends StatelessWidget {
  const QuestionImage({super.key, required this.path});

  /// Server-relative signed link, e.g. `/api/files/<key>?exp=...`.
  final String path;

  @override
  Widget build(BuildContext context) {
    final url = absoluteUrl(path);
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: GestureDetector(
        onTap: () => showDialog<void>(
          context: context,
          builder: (_) => Dialog.fullscreen(
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
                      onPressed: () => Navigator.pop(context),
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
            constraints: const BoxConstraints(maxHeight: 260),
            width: double.infinity,
            color: Colors.white,
            child: Image.network(
              url,
              fit: BoxFit.contain,
              loadingBuilder: (_, child, progress) => progress == null
                  ? child
                  : const SizedBox(height: 120, child: Center(child: CircularProgressIndicator())),
              errorBuilder: (_, _, _) => const SizedBox(
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

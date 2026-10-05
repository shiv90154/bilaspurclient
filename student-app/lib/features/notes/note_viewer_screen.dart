import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

/// In-app reader. The PDF lives in memory only: no file is written, no share or "open with".
/// The app-wide watermark (see app.dart) and FLAG_SECURE cover this screen too.
class NoteViewerScreen extends ConsumerStatefulWidget {
  const NoteViewerScreen({super.key, required this.note});
  final Note note;

  @override
  ConsumerState<NoteViewerScreen> createState() => _NoteViewerScreenState();
}

class _NoteViewerScreenState extends ConsumerState<NoteViewerScreen> {
  late Future<Uint8List> _bytes = ref.read(contentApiProvider).noteBytes(widget.note.id);

  void _retry() => setState(() => _bytes = ref.read(contentApiProvider).noteBytes(widget.note.id));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.note.title, overflow: TextOverflow.ellipsis)),
      body: FutureBuilder<Uint8List>(
        future: _bytes,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) return ErrorRetry(message: snap.error.toString(), onRetry: _retry);
          return PdfViewer.data(
            snap.data!,
            // Includes the version so a replaced PDF never shows a stale cached render.
            sourceName: 'note-${widget.note.id}-v${widget.note.version}',
          );
        },
      ),
    );
  }
}

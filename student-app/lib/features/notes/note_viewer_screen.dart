import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../data/offline_notes.dart';
import '../../widgets/async_view.dart';
import 'notes_screen.dart';

/// What the viewer opened: the PDF and where it came from.
class _Loaded {
  const _Loaded(this.bytes, {required this.fromOffline, required this.stale});
  final Uint8List bytes;
  final bool fromOffline;

  /// An offline copy shown because the server could not be reached; a newer version may exist.
  final bool stale;
}

/// In-app reader. Online, the PDF lives in memory only. "Save offline" keeps an encrypted copy
/// inside the app (see [OfflineNotes]); nothing is ever shared or opened by another app.
/// The app-wide watermark (see app.dart) and FLAG_SECURE cover this screen too.
class NoteViewerScreen extends ConsumerStatefulWidget {
  const NoteViewerScreen({super.key, required this.note});
  final Note note;

  @override
  ConsumerState<NoteViewerScreen> createState() => _NoteViewerScreenState();
}

class _NoteViewerScreenState extends ConsumerState<NoteViewerScreen> {
  late Future<_Loaded> _pdf = _load();
  bool _saved = false;
  bool _busy = false;

  OfflineNotes get _offline => ref.read(offlineNotesProvider);

  Future<_Loaded> _load() async {
    final copy = await _offline.get(widget.note.id);
    if (mounted) setState(() => _saved = copy != null);
    // Same version saved: open it at once, no internet needed.
    if (copy != null && copy.version == widget.note.version) {
      final bytes = await _offline.read(widget.note.id);
      if (bytes != null) return _Loaded(bytes, fromOffline: true, stale: false);
    }
    try {
      final bytes = await ref.read(contentApiProvider).noteBytes(widget.note.id);
      // The teacher replaced the PDF: refresh the saved copy too.
      if (copy != null) await _offline.save(widget.note, bytes);
      return _Loaded(bytes, fromOffline: false, stale: false);
    } catch (e) {
      final bytes = copy == null ? null : await _offline.read(widget.note.id);
      if (bytes != null) return _Loaded(bytes, fromOffline: true, stale: true);
      rethrow;
    }
  }

  void _retry() => setState(() => _pdf = _load());

  Future<void> _toggleOffline(Uint8List bytes) async {
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      if (_saved) {
        await _offline.remove(widget.note.id);
        messenger.showSnackBar(const SnackBar(content: Text('Removed from offline notes.')));
      } else {
        await _offline.save(widget.note, bytes);
        messenger.showSnackBar(const SnackBar(content: Text('Saved. You can read this note without internet.')));
      }
      if (mounted) setState(() => _saved = !_saved);
      ref.invalidate(offlineNoteIdsProvider);
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Could not save on this phone. Free some space and try again.')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_Loaded>(
      future: _pdf,
      builder: (context, snap) {
        final loaded = snap.data;
        return Scaffold(
          appBar: AppBar(
            title: Text(widget.note.title, overflow: TextOverflow.ellipsis),
            actions: [
              if (loaded != null)
                IconButton(
                  tooltip: _saved ? 'Remove offline copy' : 'Save for offline',
                  icon: _busy
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : Icon(_saved ? Icons.offline_pin : Icons.download_for_offline_outlined),
                  onPressed: _busy ? null : () => _toggleOffline(loaded.bytes),
                ),
            ],
          ),
          body: () {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) return ErrorRetry(message: snap.error.toString(), onRetry: _retry);
            return Column(
              children: [
                if (loaded!.stale)
                  MaterialBanner(
                    content: const Text('No internet. Showing your saved copy; the teacher may have updated it.'),
                    leading: const Icon(Icons.cloud_off),
                    actions: [TextButton(onPressed: _retry, child: const Text('Retry'))],
                  ),
                Expanded(
                  child: PdfViewer.data(
                    loaded.bytes,
                    // Includes the version so a replaced PDF never shows a stale cached render.
                    sourceName: 'note-${widget.note.id}-v${widget.note.version}${loaded.fromOffline ? '-offline' : ''}',
                  ),
                ),
              ],
            );
          }(),
        );
      },
    );
  }
}

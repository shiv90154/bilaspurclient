import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../data/offline_notes.dart';
import '../../widgets/async_view.dart';

/// The notes list, or (no internet) the notes saved on this phone.
class NotesView {
  const NotesView(this.notes, {required this.offline});
  final List<Note> notes;
  final bool offline;
}

final notesProvider = FutureProvider.autoDispose<NotesView>((ref) async {
  final saved = ref.watch(offlineNotesProvider);
  try {
    final notes = await ref.watch(contentApiProvider).notes();
    // Removed by the teacher or no longer in the student's batch: its offline copy goes too.
    await saved.keepOnly(notes.map((n) => n.id));
    ref.invalidate(offlineNoteIdsProvider);
    return NotesView(notes, offline: false);
  } on ApiException catch (e) {
    if (e.code == 'NETWORK') {
      final local = await saved.list();
      if (local.isNotEmpty) return NotesView([for (final n in local) n.toNote()], offline: true);
    }
    rethrow;
  }
});

/// Ids of notes saved for offline reading (for the badge in the list).
final offlineNoteIdsProvider = FutureProvider<Set<String>>(
  (ref) async => {for (final n in await ref.watch(offlineNotesProvider).list()) n.id},
);

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedIds = ref.watch(offlineNoteIdsProvider).value ?? const <String>{};
    return Scaffold(
      appBar: AppBar(
        title: const Text('Study material'),
        actions: [
          IconButton(tooltip: 'Search', icon: const Icon(Icons.search), onPressed: () => context.push('/search')),
        ],
      ),
      body: AsyncView<NotesView>(
        value: ref.watch(notesProvider),
        onRetry: () => ref.invalidate(notesProvider),
        builder: (view) {
          final notes = view.notes;
          if (notes.isEmpty) {
            return const EmptyState(
              icon: Icons.menu_book_outlined,
              title: 'No notes yet',
              text: 'PDF notes your teachers share with your batch will appear here, grouped by subject.',
            );
          }
          // Group by subject so a student finds Physics notes under Physics.
          final groups = <String, List<Note>>{};
          for (final n in notes) {
            (groups[n.subject ?? 'General'] ??= []).add(n);
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(notesProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (view.offline)
                  Card(
                    color: Theme.of(context).colorScheme.secondaryContainer,
                    margin: const EdgeInsets.only(bottom: 12),
                    child: const ListTile(
                      leading: Icon(Icons.cloud_off),
                      title: Text('No internet'),
                      subtitle: Text('Showing the notes saved on this phone. Pull down to try again.'),
                    ),
                  )
                else if (savedIds.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      'Tip: open a note and tap the download icon to read it without internet.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                for (final entry in groups.entries) ...[
                  Padding(
                    padding: const EdgeInsets.only(top: 8, bottom: 8),
                    child: Text(entry.key, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                  for (final n in entry.value)
                    Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        leading: const Icon(Icons.picture_as_pdf_outlined),
                        title: Text(n.title),
                        subtitle: Text([if (n.topic != null) n.topic!, '${(n.size / 1024 / 1024).toStringAsFixed(1)} MB'].join(' · ')),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (savedIds.contains(n.id))
                              const Padding(
                                padding: EdgeInsets.only(right: 4),
                                child: Icon(Icons.offline_pin, size: 18, semanticLabel: 'Saved offline'),
                              ),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                        onTap: () => context.push('/notes/${n.id}', extra: n),
                      ),
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

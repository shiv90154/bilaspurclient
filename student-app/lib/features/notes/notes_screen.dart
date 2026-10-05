import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final notesProvider = FutureProvider.autoDispose<List<Note>>((ref) => ref.watch(contentApiProvider).notes());

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Study material')),
      body: AsyncView<List<Note>>(
        value: ref.watch(notesProvider),
        onRetry: () => ref.invalidate(notesProvider),
        builder: (notes) {
          if (notes.isEmpty) {
            return const EmptyState(icon: Icons.menu_book_outlined, text: 'No notes shared with your batch yet.');
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
                        trailing: const Icon(Icons.chevron_right),
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

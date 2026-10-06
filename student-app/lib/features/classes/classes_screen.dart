import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final classesProvider =
    FutureProvider.autoDispose<List<LiveClass>>((ref) => ref.watch(contentApiProvider).upcomingClasses());

String dayLabel(DateTime d) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(d.year, d.month, d.day);
  final diff = day.difference(today).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Tomorrow';
  return DateFormat('EEE, d MMM').format(d);
}

String timeRange(LiveClass c) => '${DateFormat('h:mm a').format(c.startAt)} – ${DateFormat('h:mm a').format(c.endAt)}';

/// Asks the server to let the student in (which also marks attendance), then opens the Zoom / Meet link.
Future<void> joinClass(BuildContext context, WidgetRef ref, LiveClass c) async {
  try {
    final url = await ref.read(contentApiProvider).joinClass(c.id);
    final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      showError(context, 'Could not open the class link. Install Zoom or Google Meet, or open it in a browser.');
    }
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

class ClassTile extends ConsumerWidget {
  const ClassTile({super.key, required this.item});
  final LiveClass item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final c = item;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: c.isLive ? Colors.green.shade100 : scheme.primaryContainer,
              foregroundColor: c.isLive ? Colors.green.shade800 : scheme.onPrimaryContainer,
              child: Icon(c.isLive ? Icons.sensors : Icons.videocam_outlined),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(
                    '${c.isLive ? 'Live now · ' : '${dayLabel(c.startAt)} · '}${timeRange(c)}${c.teacher == null ? '' : '\n${c.teacher}'}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              // Before the window opens the button explains instead of failing.
              onPressed: c.canJoinNow
                  ? () => joinClass(context, ref, c)
                  : () => showError(context, 'You can join from 15 minutes before the class starts.'),
              style: c.canJoinNow ? null : FilledButton.styleFrom(backgroundColor: scheme.surfaceContainerHighest, foregroundColor: scheme.onSurfaceVariant),
              child: Text(c.isLive ? 'Join now' : 'Join'),
            ),
          ],
        ),
      ),
    );
  }
}

class ClassesScreen extends ConsumerWidget {
  const ClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Live classes')),
      body: AsyncView<List<LiveClass>>(
        value: ref.watch(classesProvider),
        onRetry: () => ref.invalidate(classesProvider),
        builder: (classes) {
          if (classes.isEmpty) {
            return const EmptyState(
              icon: Icons.videocam_outlined,
              title: 'No classes scheduled',
              text: 'New classes show up here as soon as your teacher adds them, and you get a reminder before each one.',
            );
          }
          // Group by day so "Today" and "Tomorrow" read naturally.
          final groups = <String, List<LiveClass>>{};
          for (final c in classes) {
            (groups[c.isLive ? 'Live now' : dayLabel(c.startAt)] ??= []).add(c);
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(classesProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final e in groups.entries) ...[
                  Padding(
                    padding: const EdgeInsets.only(top: 6, bottom: 8),
                    child: Text(e.key, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                  for (final c in e.value) ClassTile(item: c),
                ],
                const SizedBox(height: 4),
                Text('You can join from 15 minutes before a class starts.', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          );
        },
      ),
    );
  }
}

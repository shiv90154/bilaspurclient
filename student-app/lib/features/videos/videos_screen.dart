import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final videosProvider = FutureProvider.autoDispose<List<VideoItem>>((ref) => ref.watch(contentApiProvider).videos());

/// Recorded lectures of the student's batches, plus the institute's free demo videos.
class VideosScreen extends ConsumerWidget {
  const VideosScreen({super.key});

  Future<void> _open(BuildContext context, VideoItem v) async {
    if (v.isFile) {
      context.push('/videos/${v.id}', extra: v);
      return;
    }
    final ok = v.url != null && await launchUrl(Uri.parse(v.url!), mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open this video.')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recorded videos'),
        actions: [
          IconButton(tooltip: 'Search', icon: const Icon(Icons.search), onPressed: () => context.push('/search')),
        ],
      ),
      body: AsyncView<List<VideoItem>>(
        value: ref.watch(videosProvider),
        onRetry: () => ref.invalidate(videosProvider),
        builder: (videos) {
          if (videos.isEmpty) {
            return const EmptyState(
              icon: Icons.play_circle_outline,
              title: 'No videos yet',
              text: 'Recorded lectures from your teachers will appear here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(videosProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: videos.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final v = videos[i];
                return Card(
                  margin: EdgeInsets.zero,
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: scheme.secondaryContainer,
                      foregroundColor: scheme.onSecondaryContainer,
                      child: const Icon(Icons.play_arrow),
                    ),
                    title: Text(v.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                    subtitle: v.isDemo || v.description != null || v.durationSec != null
                        ? Text(
                            [if (v.isDemo) 'Free demo', if (v.durationSec != null) _length(v.durationSec!), ?v.description].join(' · '),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          )
                        : null,
                    trailing: Icon(v.isFile ? Icons.chevron_right : Icons.open_in_new, size: 18),
                    onTap: () => _open(context, v),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

String _length(int sec) => sec >= 3600 ? '${sec ~/ 3600} h ${(sec % 3600) ~/ 60} min' : '${(sec / 60).ceil()} min';

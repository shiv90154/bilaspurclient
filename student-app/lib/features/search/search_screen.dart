import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../data/models.dart';
import '../notes/notes_screen.dart';
import '../tests/tests_screen.dart';
import '../videos/videos_screen.dart';

/// One box for notes, recorded videos and tests. Lists are small (a student's batches), so they
/// are loaded once and filtered on the phone: instant results, and saved notes work offline.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  /// Every word must appear somewhere in the item ("kinematics phy" finds Physics › Kinematics).
  static bool _matches(String q, List<String?> fields) {
    final hay = fields.whereType<String>().join(' ').toLowerCase();
    return q.toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).every(hay.contains);
  }

  Future<void> _openVideo(VideoItem v) async {
    if (v.isFile) {
      await context.push('/videos/${v.id}', extra: v);
    } else if (v.url != null) {
      await launchUrl(Uri.parse(v.url!), mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.text.trim();
    final notes = ref.watch(notesProvider);
    final videos = ref.watch(videosProvider);
    final tests = ref.watch(testsProvider);
    final theme = Theme.of(context);

    final noteHits = q.isEmpty ? <Note>[] : (notes.value?.notes ?? []).where((n) => _matches(q, [n.title, n.subject, n.topic, n.description])).toList();
    final videoHits = q.isEmpty ? <VideoItem>[] : (videos.value ?? []).where((v) => _matches(q, [v.title, v.description])).toList();
    final testHits = q.isEmpty ? <TestSummary>[] : (tests.value ?? []).where((t) => _matches(q, [t.title, t.seriesName])).toList();
    final loading = notes.isLoading || videos.isLoading || tests.isLoading;
    final total = noteHits.length + videoHits.length + testHits.length;

    Widget header(String text, int count) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
          child: Text('$text ($count)', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
        );

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _query,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Search notes, videos, tests',
            border: InputBorder.none,
            suffixIcon: q.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear',
                    icon: const Icon(Icons.close),
                    onPressed: () => setState(_query.clear),
                  ),
          ),
          onChanged: (_) => setState(() {}),
        ),
      ),
      body: q.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text('Type a subject, topic or title.', textAlign: TextAlign.center),
              ),
            )
          : ListView(
              children: [
                if (loading) const LinearProgressIndicator(),
                if (!loading && total == 0)
                  Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text('Nothing found for “$q”.', textAlign: TextAlign.center),
                  ),
                if (noteHits.isNotEmpty) ...[
                  header('Notes', noteHits.length),
                  for (final n in noteHits)
                    ListTile(
                      leading: const Icon(Icons.picture_as_pdf_outlined),
                      title: Text(n.title),
                      subtitle: Text([n.subject ?? 'General', ?n.topic].join(' › ')),
                      onTap: () => context.push('/notes/${n.id}', extra: n),
                    ),
                ],
                if (videoHits.isNotEmpty) ...[
                  header('Videos', videoHits.length),
                  for (final v in videoHits)
                    ListTile(
                      leading: const Icon(Icons.play_circle_outline),
                      title: Text(v.title),
                      subtitle: v.description == null ? null : Text(v.description!, maxLines: 1, overflow: TextOverflow.ellipsis),
                      onTap: () => _openVideo(v),
                    ),
                ],
                if (testHits.isNotEmpty) ...[
                  header('Tests', testHits.length),
                  for (final t in testHits)
                    ListTile(
                      leading: const Icon(Icons.quiz_outlined),
                      title: Text(t.title),
                      subtitle: Text(t.attemptId != null ? 'See your result' : 'Open in Tests'),
                      onTap: () => t.attemptId != null ? context.push('/tests/result/${t.attemptId}') : context.go('/tests'),
                    ),
                ],
                const SizedBox(height: 24),
              ],
            ),
    );
  }
}

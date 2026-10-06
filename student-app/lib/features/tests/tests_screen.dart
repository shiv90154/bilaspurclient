import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';

final testsProvider = FutureProvider.autoDispose<List<TestSummary>>((ref) => ref.watch(contentApiProvider).tests());

class TestsScreen extends ConsumerWidget {
  const TestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tests')),
      body: AsyncView<List<TestSummary>>(
        value: ref.watch(testsProvider),
        onRetry: () => ref.invalidate(testsProvider),
        builder: (tests) {
          if (tests.isEmpty) {
            return const EmptyState(
              icon: Icons.quiz_outlined,
              title: 'No tests yet',
              text: 'Tests your teachers publish for your batch will appear here, grouped by series.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(testsProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // A series is a bundle of tests (e.g. "NEET Mock Series 2027"); stand-alone tests come last.
                for (final group in _groupBySeries(tests)) ...[
                  if (group.name != null) _SeriesHeader(name: group.name!, tests: group.tests),
                  for (final t in group.tests) _TestCard(test: t),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Group {
  const _Group(this.name, this.tests);
  final String? name;
  final List<TestSummary> tests;
}

List<_Group> _groupBySeries(List<TestSummary> tests) {
  final bySeries = <String, List<TestSummary>>{};
  final loose = <TestSummary>[];
  for (final t in tests) {
    final n = t.seriesName;
    if (n == null) {
      loose.add(t);
    } else {
      (bySeries[n] ??= []).add(t);
    }
  }
  final names = bySeries.keys.toList()..sort();
  return [
    for (final n in names) _Group(n, bySeries[n]!),
    if (loose.isNotEmpty) _Group(bySeries.isEmpty ? null : 'Other tests', loose),
  ];
}

class _SeriesHeader extends StatelessWidget {
  const _SeriesHeader({required this.name, required this.tests});
  final String name;
  final List<TestSummary> tests;

  @override
  Widget build(BuildContext context) {
    final done = tests.where((t) => t.state == TestState.attempted).length;
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.layers_outlined, size: 20, color: scheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 12),
              Text('$done / ${tests.length} done', style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: tests.isEmpty ? 0 : done / tests.length, minHeight: 6),
          ),
        ],
      ),
    );
  }
}

class _TestCard extends ConsumerWidget {
  const _TestCard({required this.test});
  final TestSummary test;

  String get _when {
    final f = DateFormat('d MMM, h:mm a');
    return switch (test.state) {
      TestState.upcoming => 'Opens ${f.format(test.startAt!)}',
      TestState.open when test.endAt != null => 'Open until ${f.format(test.endAt!)}',
      TestState.open => 'Open now',
      TestState.inProgress => 'In progress',
      TestState.attempted => 'Score ${fmtMarks(test.score ?? 0)} / ${fmtMarks(test.totalMarks)}',
      TestState.ended => 'Ended',
    };
  }

  Future<void> _start(BuildContext context, WidgetRef ref) async {
    final go = test.state == TestState.inProgress ||
        await showDialog<bool>(context: context, builder: (_) => _StartDialog(test: test)) == true;
    if (!go || !context.mounted) return;
    try {
      final paper = await ref.read(contentApiProvider).startTest(test.id);
      if (!context.mounted) return;
      await context.push<void>('/tests/take', extra: paper);
    } on ApiException catch (e) {
      if (context.mounted) showError(context, e);
    }
    ref.invalidate(testsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canStart = test.state == TestState.open || test.state == TestState.inProgress;
    final hasResult = test.state == TestState.attempted && test.attemptId != null;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(test.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('${test.questionCount} questions · ${test.durationMin} min · ${fmtMarks(test.totalMarks)} marks'),
            const SizedBox(height: 2),
            Text(_when, style: Theme.of(context).textTheme.bodySmall),
            if (canStart || hasResult) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: canStart
                    ? FilledButton(
                        onPressed: () => _start(context, ref),
                        child: Text(test.state == TestState.inProgress ? 'Resume' : 'Start test'),
                      )
                    : OutlinedButton(
                        onPressed: () => context.push('/tests/result/${test.attemptId}'),
                        child: const Text('View result'),
                      ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// What the student agrees to before the clock starts. Its own widget on purpose: the buttons close
/// *this* dialog (their context), never the page behind it.
class _StartDialog extends StatelessWidget {
  const _StartDialog({required this.test});
  final TestSummary test;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    Widget line(IconData icon, String text) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 20, color: scheme.primary),
              const SizedBox(width: 12),
              Expanded(child: Text(text)),
            ],
          ),
        );
    return AlertDialog(
      title: Text(test.title),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            line(Icons.help_outline, '${test.questionCount} questions · ${fmtMarks(test.totalMarks)} marks'),
            line(Icons.timer_outlined, '${test.durationMin} minutes. The timer starts now and keeps running even if you close the app.'),
            if (test.negativeMark > 0)
              line(Icons.remove_circle_outline, '${fmtMarks(test.negativeMark)} mark is deducted for each wrong answer. Skipped questions lose nothing.'),
            line(Icons.looks_one_outlined, 'You can attempt this test only once.'),
            line(Icons.cloud_done_outlined, 'Your answers are saved as you go.'),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Start test')),
      ],
    );
  }
}

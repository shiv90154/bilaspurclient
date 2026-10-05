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
            return const EmptyState(icon: Icons.quiz_outlined, text: 'No tests for your batch yet.');
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(testsProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: tests.length,
              itemBuilder: (_, i) => _TestCard(test: tests[i]),
            ),
          );
        },
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
        await showDialog<bool>(
              context: context,
              builder: (_) => AlertDialog(
                title: Text(test.title),
                content: Text(
                  '${test.questionCount} questions · ${test.durationMin} minutes · ${fmtMarks(test.totalMarks)} marks\n'
                  '${test.negativeMark > 0 ? '${fmtMarks(test.negativeMark)} mark(s) deducted for each wrong answer.\n' : ''}'
                  '\nYou can attempt this only once. The timer starts now and keeps running even if you close the app.',
                ),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                  FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Start')),
                ],
              ),
            ) ==
            true;
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

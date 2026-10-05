import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';
import 'tests_screen.dart';

final resultProvider =
    FutureProvider.autoDispose.family<TestResult, String>((ref, id) => ref.watch(contentApiProvider).result(id));

class ResultScreen extends ConsumerWidget {
  const ResultScreen({super.key, required this.attemptId});
  final String attemptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          ref.invalidate(testsProvider);
          context.go('/tests');
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Result'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              ref.invalidate(testsProvider);
              context.go('/tests');
            },
          ),
        ),
        body: AsyncView<TestResult>(
          value: ref.watch(resultProvider(attemptId)),
          onRetry: () => ref.invalidate(resultProvider(attemptId)),
          builder: (r) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(r.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              if (r.autoSubmitted)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text('Submitted automatically when time ran out.', style: Theme.of(context).textTheme.bodySmall),
                ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Text('${fmtMarks(r.score)} / ${fmtMarks(r.totalMarks)}',
                          style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w800)),
                      Text('${r.percentage.toStringAsFixed(1)}%'),
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _Stat('Correct', r.correct, Colors.green.shade700),
                          _Stat('Wrong', r.incorrect, Theme.of(context).colorScheme.error),
                          _Stat('Skipped', r.unanswered, Theme.of(context).colorScheme.outline),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (r.review == null)
                const Card(
                  child: ListTile(
                    leading: Icon(Icons.lock_clock_outlined),
                    title: Text('Answers unlock later'),
                    subtitle: Text('Correct answers and explanations appear after the test window closes for everyone.'),
                  ),
                )
              else ...[
                Text('Review', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                for (var i = 0; i < r.review!.length; i++) _ReviewCard(index: i + 1, q: r.review![i]),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text('$value', style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: color, fontWeight: FontWeight.w800)),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      );
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.index, required this.q});
  final int index;
  final ReviewQuestion q;

  @override
  Widget build(BuildContext context) {
    final skipped = q.selected.isEmpty;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  skipped ? Icons.remove_circle_outline : (q.isCorrect ? Icons.check_circle : Icons.cancel),
                  color: skipped ? Colors.grey : (q.isCorrect ? Colors.green.shade700 : Theme.of(context).colorScheme.error),
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(child: Text('$index. ${q.text}', style: const TextStyle(fontWeight: FontWeight.w600))),
              ],
            ),
            const SizedBox(height: 8),
            for (final o in q.options)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: o.isCorrect
                      ? Colors.green.shade50
                      : q.selected.contains(o.id)
                          ? Theme.of(context).colorScheme.errorContainer
                          : null,
                  border: Border.all(color: o.isCorrect ? Colors.green.shade400 : Theme.of(context).dividerColor),
                ),
                child: Text('${o.text}${q.selected.contains(o.id) ? '   (your answer)' : ''}'),
              ),
            if (q.explanation != null && q.explanation!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text('Explanation: ${q.explanation}', style: Theme.of(context).textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';
import '../../widgets/question_image.dart';
import 'attempt_session.dart';

/// The exam screen. The server owns the clock: the countdown is only a display, and the server
/// auto-submits at the deadline even if this app is closed.
class TakeTestScreen extends ConsumerStatefulWidget {
  const TakeTestScreen({super.key, required this.paper});
  final Paper paper;

  @override
  ConsumerState<TakeTestScreen> createState() => _TakeTestScreenState();
}

class _TakeTestScreenState extends ConsumerState<TakeTestScreen> with WidgetsBindingObserver {
  late final ContentApi _api = ref.read(contentApiProvider);
  late final AttemptSession _session = AttemptSession(widget.paper, (changed) => _api.saveAnswers(widget.paper.attemptId, changed));
  Timer? _ticker;
  int _index = 0;
  bool _submitting = false;

  PaperQuestion get _q => widget.paper.questions[_index];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (widget.paper.remaining == Duration.zero) {
        unawaited(_finish(timeUp: true));
      } else {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    _session.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // Tell the server (shown to teachers) and save what we have before the OS may kill us.
      unawaited(_api.reportBackground(widget.paper.attemptId));
      unawaited(_session.flush());
    }
  }

  Future<void> _finish({bool timeUp = false}) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    _ticker?.cancel();
    await _session.flush();
    try {
      await _api.submit(widget.paper.attemptId);
    } on ApiException catch (e) {
      // ATTEMPT_ENDED means the server already closed it (time ran out): the result is still there.
      if (e.code != 'ATTEMPT_ENDED') {
        if (!mounted) return;
        setState(() => _submitting = false);
        _ticker = Timer.periodic(const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
        showError(context, e);
        return;
      }
    }
    if (!mounted) return;
    if (timeUp) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Time is up. Your test was submitted.')));
    }
    context.go('/tests/result/${widget.paper.attemptId}');
  }

  Future<void> _confirmSubmit() async {
    final unanswered = widget.paper.questions.length - _session.answered;
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Submit test?'),
        content: Text(unanswered == 0
            ? 'You answered every question. You cannot change answers after submitting.'
            : '$unanswered question(s) are unanswered. You cannot change answers after submitting.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep working')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Submit')),
        ],
      ),
    );
    if (ok == true) await _finish();
  }

  Future<void> _openPalette() async {
    final picked = await showModalBottomSheet<int>(
      context: context,
      builder: (_) => _Palette(paper: widget.paper, current: _index),
    );
    if (picked != null) setState(() => _index = picked);
  }

  String _clock(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final paper = widget.paper;
    final q = _q;
    final left = paper.remaining;
    final scheme = Theme.of(context).colorScheme;

    return PopScope(
      canPop: false, // leaving mid-test would not stop the clock, so make it deliberate
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          ScaffoldMessenger.of(context)
            ..hideCurrentSnackBar()
            ..showSnackBar(const SnackBar(content: Text('Use Submit to finish the test.')));
        }
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Text(paper.title, overflow: TextOverflow.ellipsis),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: left.inMinutes < 5 ? scheme.errorContainer : scheme.primaryContainer,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(_clock(left), style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()])),
                ),
              ),
            ),
          ],
        ),
        body: Column(
          children: [
            LinearProgressIndicator(value: _session.answered / paper.questions.length),
            if (_session.lastSaveError != null)
              Container(
                width: double.infinity,
                color: scheme.errorContainer,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: const Text('Connection problem: answers will be saved when it returns.', style: TextStyle(fontSize: 12)),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Text('Question ${_index + 1} of ${paper.questions.length}',
                          style: Theme.of(context).textTheme.labelLarge),
                      const Spacer(),
                      Text('${fmtMarks(q.marks)} mark${q.marks == 1 ? '' : 's'}', style: Theme.of(context).textTheme.labelLarge),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(q.text, style: Theme.of(context).textTheme.titleMedium),
                  if (q.imageUrl != null) QuestionImage(path: q.imageUrl!),
                  if (q.multiple)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text('Select all that apply', style: Theme.of(context).textTheme.bodySmall),
                    ),
                  const SizedBox(height: 14),
                  for (final o in q.options)
                    Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      color: q.selected.contains(o.id) ? scheme.primaryContainer : null,
                      child: ListTile(
                        leading: Icon(q.multiple
                            ? (q.selected.contains(o.id) ? Icons.check_box : Icons.check_box_outline_blank)
                            : (q.selected.contains(o.id) ? Icons.radio_button_checked : Icons.radio_button_unchecked)),
                        title: Text(o.text),
                        onTap: _submitting ? null : () => setState(() => _session.select(q, o.id)),
                      ),
                    ),
                  Row(
                    children: [
                      TextButton.icon(
                        onPressed: q.selected.isEmpty ? null : () => setState(() => _session.clear(q)),
                        icon: const Icon(Icons.clear),
                        label: const Text('Clear'),
                      ),
                      TextButton.icon(
                        onPressed: () => setState(() => _session.toggleMarked(q)),
                        icon: Icon(q.marked ? Icons.bookmark : Icons.bookmark_border),
                        label: Text(q.marked ? 'Marked for review' : 'Mark for review'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                child: Row(
                  children: [
                    IconButton.outlined(
                      tooltip: 'Previous',
                      onPressed: _index == 0 ? null : () => setState(() => _index--),
                      icon: const Icon(Icons.chevron_left),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton.icon(onPressed: _openPalette, icon: const Icon(Icons.grid_view), label: const Text('Questions')),
                    const Spacer(),
                    if (_index < paper.questions.length - 1)
                      FilledButton(onPressed: () => setState(() => _index++), child: const Text('Next'))
                    else
                      FilledButton(onPressed: _submitting ? null : _confirmSubmit, child: Text(_submitting ? 'Submitting…' : 'Submit')),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Palette extends StatelessWidget {
  const _Palette({required this.paper, required this.current});
  final Paper paper;
  final int current;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Jump to question', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('Green: answered · Orange: marked · Grey: not answered', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            Flexible(
              child: SingleChildScrollView(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (var i = 0; i < paper.questions.length; i++)
                      InkWell(
                        onTap: () => Navigator.pop(context, i),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          width: 44,
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: paper.questions[i].marked
                                ? Colors.orange.shade300
                                : paper.questions[i].selected.isNotEmpty
                                    ? Colors.green.shade300
                                    : scheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(8),
                            border: i == current ? Border.all(color: scheme.primary, width: 2) : null,
                          ),
                          child: Text('${i + 1}'),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

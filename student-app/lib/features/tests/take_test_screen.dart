import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../data/content_api.dart';
import '../../data/models.dart';
import '../../widgets/async_view.dart';
import '../../widgets/question_image.dart';
import 'attempt_session.dart';

/// Photos of a written answer, per question (the server enforces the same limit).
const _maxPhotos = 5;

/// Longest the camera may stay open before coming back counts as leaving the test.
const _cameraGrace = Duration(minutes: 3);

/// The exam screen. The server owns the clock: the countdown is only a display, and the server
/// auto-submits at the deadline even if this app is closed.
///
/// Leaving the app (home button, another app, a call) is reported when the student comes back; past
/// the test's limit the server submits the test. Written answers cannot be pasted.
class TakeTestScreen extends ConsumerStatefulWidget {
  const TakeTestScreen({super.key, required this.paper});
  final Paper paper;

  @override
  ConsumerState<TakeTestScreen> createState() => _TakeTestScreenState();
}

class _TakeTestScreenState extends ConsumerState<TakeTestScreen> with WidgetsBindingObserver {
  late final ContentApi _api = ref.read(contentApiProvider);
  late final AttemptSession _session = AttemptSession(widget.paper, (changed) => _api.saveAnswers(widget.paper.attemptId, changed));
  final Map<String, TextEditingController> _text = {};
  Timer? _ticker;
  int _index = 0;
  bool _submitting = false;

  /// The app went to the background and the student has not come back yet.
  bool _away = false;

  /// Leaves not yet reported to the server (no network when the student came back).
  int _unreported = 0;
  Timer? _retryLeave;

  /// When the camera was opened for an answer photo: that trip out of the app is allowed.
  DateTime? _cameraSince;
  String? _uploadingFor;

  PaperQuestion get _q => widget.paper.questions[_index];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_clearClipboard());
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (widget.paper.remaining == Duration.zero) {
        unawaited(_finish(timeUp: true));
      } else {
        setState(() {});
      }
    });
    // Resumed after the app was closed: the server already counted that as a leave.
    if (widget.paper.leaves > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _warnLeave(LeaveResult(leaves: widget.paper.leaves, maxLeaves: widget.paper.maxLeaves, submitted: false));
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    _retryLeave?.cancel();
    _session.dispose();
    for (final c in _text.values) {
      c.dispose();
    }
    super.dispose();
  }

  /// Nothing copied before the test (or while away) can be pasted into an answer.
  Future<void> _clearClipboard() async {
    try {
      await Clipboard.setData(const ClipboardData(text: ''));
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_submitting) return;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      // Save what we have before the OS may kill us.
      unawaited(_session.flush());
      _away = true;
    } else if (state == AppLifecycleState.resumed && _away) {
      _away = false;
      unawaited(_clearClipboard());
      final camera = _cameraSince;
      _cameraSince = null;
      if (camera != null && DateTime.now().difference(camera) < _cameraGrace) return;
      _unreported++;
      unawaited(_reportLeaves());
    }
  }

  Future<void> _reportLeaves() async {
    _retryLeave?.cancel();
    while (_unreported > 0 && mounted && !_submitting) {
      final LeaveResult res;
      try {
        res = await _api.reportLeave(widget.paper.attemptId);
      } on ApiException {
        // Offline: try again shortly. The leave is not forgotten.
        _retryLeave = Timer(const Duration(seconds: 5), () => unawaited(_reportLeaves()));
        return;
      }
      _unreported--;
      widget.paper.leaves = res.leaves;
      if (!mounted) return;
      if (res.submitted) {
        _endedByServer('You left the test too many times, so it was submitted.');
        return;
      }
      if (_unreported == 0) _warnLeave(res);
    }
  }

  void _warnLeave(LeaveResult res) {
    if (res.maxLeaves == 0) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('You left the test. Your teacher can see this.')));
      return;
    }
    final last = res.leaves >= res.maxLeaves;
    unawaited(showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(Icons.warning_amber_rounded, color: Theme.of(dialogContext).colorScheme.error, size: 36),
        title: Text('Warning ${res.leaves} of ${res.maxLeaves}'),
        content: Text(last
            ? 'You left the test app. If you leave once more, your test will be submitted automatically.'
            : 'You left the test app. After ${res.maxLeaves} warnings, leaving again submits your test automatically. '
                'Do not switch apps, go to the home screen or take calls during the test.'),
        actions: [FilledButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Continue test'))],
      ),
    ));
  }

  void _endedByServer(String message) {
    _submitting = true;
    _ticker?.cancel();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    context.go('/tests/result/${widget.paper.attemptId}');
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
      builder: (dialogContext) => AlertDialog(
        title: const Text('Submit test?'),
        content: Text(unanswered == 0
            ? 'You answered every question. You cannot change answers after submitting.'
            : '$unanswered question(s) are unanswered. You cannot change answers after submitting.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Keep working')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Submit')),
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

  /// Photo of the handwritten answer, straight from the camera (no gallery: a photo must be taken now).
  Future<void> _takePhoto(PaperQuestion q) async {
    _cameraSince = DateTime.now();
    final XFile? shot;
    try {
      shot = await ImagePicker().pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 70, // keeps a page photo well under the 3 MB limit
      );
    } catch (e) {
      _cameraSince = null; // the camera never opened
      if (mounted) showError(context, e);
      return;
    }
    if (shot == null || !mounted) return;
    setState(() => _uploadingFor = q.id);
    try {
      q.images = await _api.uploadAnswerImage(widget.paper.attemptId, q.id, shot.path);
    } on ApiException catch (e) {
      if (e.code == 'ATTEMPT_ENDED' && mounted) return _endedByServer('Time is up. Your test was submitted.');
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _uploadingFor = null);
    }
  }

  Future<void> _removePhoto(PaperQuestion q, AnswerImage img) async {
    setState(() => _uploadingFor = q.id);
    try {
      q.images = await _api.removeAnswerImage(widget.paper.attemptId, q.id, img.id);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _uploadingFor = null);
    }
  }

  String _clock(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  TextEditingController _controllerFor(PaperQuestion q) =>
      _text.putIfAbsent(q.id, () => TextEditingController(text: q.textAnswer));

  Widget _writtenAnswer(PaperQuestion q) {
    final scheme = Theme.of(context).colorScheme;
    final busy = _uploadingFor == q.id;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Write your answer below, or write it on paper and add photos.', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        TextField(
          key: ValueKey('answer-${q.id}'),
          controller: _controllerFor(q),
          enabled: !_submitting,
          minLines: 6,
          maxLines: 14,
          maxLength: 5000,
          keyboardType: TextInputType.multiline,
          // No selecting, copying or pasting, and no keyboard suggestions.
          enableInteractiveSelection: false,
          contextMenuBuilder: null,
          enableSuggestions: false,
          autocorrect: false,
          enableIMEPersonalizedLearning: false,
          inputFormatters: [_NoPasteFormatter(onBlocked: _pasteBlocked)],
          decoration: const InputDecoration(hintText: 'Type your answer', border: OutlineInputBorder(), alignLabelWithHint: true),
          onChanged: (v) => setState(() => _session.write(q, v)),
        ),
        const SizedBox(height: 8),
        if (q.images.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final img in q.images)
                Stack(
                  children: [
                    QuestionImage(path: img.url, thumbSize: const Size(96, 120)),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: IconButton.filledTonal(
                        tooltip: 'Remove photo',
                        visualDensity: VisualDensity.compact,
                        iconSize: 18,
                        onPressed: busy || _submitting ? null : () => _removePhoto(q, img),
                        icon: const Icon(Icons.close),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: busy || _submitting || q.images.length >= _maxPhotos ? null : () => _takePhoto(q),
              icon: busy
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.photo_camera_outlined),
              label: Text(busy ? 'Uploading…' : 'Add photo of answer'),
            ),
            const SizedBox(width: 8),
            Text('${q.images.length}/$_maxPhotos', style: TextStyle(color: scheme.outline)),
          ],
        ),
      ],
    );
  }

  void _pasteBlocked() {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Pasting is not allowed. Type your answer or add a photo.')));
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
                  if (q.written)
                    _writtenAnswer(q)
                  else
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
                      if (!q.written)
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

/// Rejects text that arrives in one go (a paste from the keyboard's clipboard strip) while normal
/// typing, one or a few characters at a time, goes through.
class _NoPasteFormatter extends TextInputFormatter {
  _NoPasteFormatter({required this.onBlocked});
  final VoidCallback onBlocked;

  static const _maxJump = 25;

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    if (newValue.text.length - oldValue.text.length > _maxJump) {
      onBlocked();
      return oldValue;
    }
    return newValue;
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
                                : paper.questions[i].answered
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

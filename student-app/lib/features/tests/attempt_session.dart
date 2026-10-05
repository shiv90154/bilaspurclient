import 'dart:async';

import '../../data/models.dart';

typedef SaveAnswers = Future<void> Function(List<PaperQuestion> changed);

/// Holds the student's answers while a test runs and keeps them saved on the server.
///
/// Answers are autosaved shortly after each change, so a crash, dead battery or killed app
/// loses at most the last second. A failed save keeps the question "dirty" and is retried
/// with the next save; [flush] is called right before submitting.
class AttemptSession {
  AttemptSession(this.paper, this._save, {this.debounce = const Duration(milliseconds: 800)});

  final Paper paper;
  final SaveAnswers _save;
  final Duration debounce;

  final Set<String> _dirty = {};
  Timer? _timer;
  Future<void>? _inFlight;

  /// Last save failure, for a small "not saved" hint in the UI. Null when everything is saved.
  Object? lastSaveError;

  bool get hasUnsaved => _dirty.isNotEmpty;

  int get answered => paper.questions.where((q) => q.selected.isNotEmpty).length;
  int get markedCount => paper.questions.where((q) => q.marked).length;

  void select(PaperQuestion q, String optionId) {
    if (q.multiple) {
      if (!q.selected.add(optionId)) q.selected.remove(optionId);
    } else {
      // Tapping the chosen option again clears it, like unticking on paper.
      final was = q.selected.contains(optionId);
      q.selected
        ..clear()
        ..addAll(was ? const <String>[] : [optionId]);
    }
    _touch(q);
  }

  void clear(PaperQuestion q) {
    q.selected.clear();
    _touch(q);
  }

  void toggleMarked(PaperQuestion q) {
    q.marked = !q.marked;
    _touch(q);
  }

  void _touch(PaperQuestion q) {
    _dirty.add(q.id);
    _timer?.cancel();
    _timer = Timer(debounce, () => unawaited(flush()));
  }

  /// Sends everything not yet saved. Never throws: failures stay queued for the next attempt.
  Future<void> flush() async {
    _timer?.cancel();
    // Serialize saves so an older request can never overwrite a newer answer.
    while (_inFlight != null) {
      await _inFlight;
    }
    if (_dirty.isEmpty) return;

    final ids = Set<String>.of(_dirty);
    final batch = [for (final q in paper.questions) if (ids.contains(q.id)) q];
    _dirty.removeAll(ids);
    final call = _save(batch).then<void>((_) {
      lastSaveError = null;
    }, onError: (Object e) {
      lastSaveError = e;
      _dirty.addAll(ids); // retry with the next save
    });
    _inFlight = call;
    await call;
    _inFlight = null;
  }

  void dispose() => _timer?.cancel();
}

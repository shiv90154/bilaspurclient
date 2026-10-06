// ignore_for_file: avoid_print
// Runs the app's pure-Dart logic checks without the Flutter test runner:
//   C:\src\flutter\bin\dart.bat run tool/check_logic.dart
// (the same cases live in test/attempt_session_test.dart for `flutter test`).
import 'dart:async';

import 'package:student_app/data/models.dart';
import 'package:student_app/features/tests/attempt_session.dart';

int failures = 0;
int passed = 0;

void check(String name, bool ok, [Object? detail]) {
  if (ok) {
    passed++;
    print('PASS $name');
  } else {
    failures++;
    print('FAIL $name ${detail ?? ''}');
  }
}

PaperQuestion q(String id, {bool multiple = false}) => PaperQuestion(
      id: id,
      text: 'Question $id',
      multiple: multiple,
      marks: 4,
      options: [for (final o in ['a', 'b', 'c']) PaperOption('$id-$o', o)],
      selected: {},
      marked: false,
    );

Paper paperOf(List<PaperQuestion> qs, {Duration? left, Duration offset = Duration.zero}) => Paper(
      attemptId: 'att',
      title: 'T',
      negativeMark: 1,
      deadline: DateTime.now().toUtc().add((left ?? const Duration(minutes: 30)) + offset),
      clockOffset: offset,
      questions: qs,
    );

Future<void> main() async {
  // ── AttemptSession ──
  {
    final s = AttemptSession(paperOf([q('1')]), (_) async {});
    final one = s.paper.questions.first;
    s.select(one, '1-a');
    check('single: tap selects', one.selected.length == 1 && one.selected.contains('1-a'));
    s.select(one, '1-b');
    check('single: another tap replaces', one.selected.length == 1 && one.selected.contains('1-b'));
    s.select(one, '1-b');
    check('single: tapping again clears', one.selected.isEmpty);
    s.dispose();
  }
  {
    final s = AttemptSession(paperOf([q('1', multiple: true)]), (_) async {});
    final one = s.paper.questions.first;
    s.select(one, '1-a');
    s.select(one, '1-c');
    s.select(one, '1-a');
    check('multiple: taps toggle independently', one.selected.length == 1 && one.selected.contains('1-c'));
    s.dispose();
  }
  {
    final saved = <List<String>>[];
    final s = AttemptSession(
      paperOf([q('1'), q('2'), q('3')]),
      (changed) async => saved.add([for (final c in changed) c.id]),
      debounce: const Duration(milliseconds: 20),
    );
    s.select(s.paper.questions[0], '1-a');
    s.select(s.paper.questions[2], '3-b');
    check('autosave waits for the debounce', saved.isEmpty);
    await Future<void>.delayed(const Duration(milliseconds: 90));
    check('autosave sends only the changed questions, in one request',
        saved.length == 1 && saved.first.join(',') == '1,3', saved);
    check('nothing left unsaved', !s.hasUnsaved);
    s.dispose();
  }
  {
    var fail = true;
    final saved = <String>[];
    final s = AttemptSession(paperOf([q('1')]), (changed) async {
      if (fail) throw Exception('offline');
      saved.addAll([for (final c in changed) c.id]);
    });
    s.select(s.paper.questions.first, '1-a');
    await s.flush();
    check('a failed save stays queued and reports the error', s.hasUnsaved && s.lastSaveError != null);
    fail = false;
    await s.flush();
    check('the next flush retries it', saved.join(',') == '1' && !s.hasUnsaved && s.lastSaveError == null, saved);
    s.dispose();
  }
  {
    final order = <String>[];
    final gate = Completer<void>();
    var first = true;
    final s = AttemptSession(paperOf([q('1')]), (changed) async {
      final snapshot = changed.first.selected.join(',');
      if (first) {
        first = false;
        await gate.future;
      }
      order.add(snapshot);
    });
    final one = s.paper.questions.first;
    s.select(one, '1-a');
    final f1 = s.flush();
    s.select(one, '1-b');
    final f2 = s.flush();
    gate.complete();
    await Future.wait([f1, f2]);
    check('saves are serialized: the newer answer is never overtaken', order.last == '1-b', order);
    s.dispose();
  }
  {
    final s = AttemptSession(paperOf([q('1'), q('2')]), (_) async {});
    s.select(s.paper.questions[0], '1-a');
    s.toggleMarked(s.paper.questions[1]);
    check('answered / marked counters', s.answered == 1 && s.markedCount == 1);
    s.dispose();
  }

  // ── Paper clock ──
  {
    final fast = paperOf([q('1')], left: const Duration(minutes: 30), offset: const Duration(minutes: -10));
    // The deadline is a server time. A phone whose clock is 10 min fast must still show ~30 min left,
    // not 20: the offset cancels the phone's error.
    check('countdown ignores a wrong phone clock (phone 10 min fast)', fast.remaining.inMinutes >= 29 && fast.remaining.inMinutes <= 30, fast.remaining);
    final slow = paperOf([q('1')], left: const Duration(minutes: 30), offset: const Duration(minutes: 15));
    check('countdown ignores a wrong phone clock (phone 15 min slow)', slow.remaining.inMinutes >= 29 && slow.remaining.inMinutes <= 30, slow.remaining);
    check('remaining never goes negative', paperOf([q('1')], left: const Duration(minutes: -5)).remaining == Duration.zero);
    final serverNow = DateTime.now().toUtc().add(const Duration(minutes: 7));
    final p = Paper.fromJson({
      'attemptId': 'a',
      'serverNow': serverNow.toIso8601String(),
      'deadline': serverNow.add(const Duration(minutes: 30)).toIso8601String(),
      'test': {'title': 'T', 'negativeMark': 1},
      'questions': [],
    });
    check('fromJson derives the offset from serverNow', p.remaining.inMinutes >= 29 && p.remaining.inMinutes <= 30, p.remaining);
  }

  // ── Review ──
  {
    ReviewQuestion review(Set<String> selected) => ReviewQuestion(
          text: 'q',
          marks: 4,
          explanation: null,
          selected: selected,
          options: const [ReviewOption('a', 'a', true), ReviewOption('b', 'b', true), ReviewOption('c', 'c', false)],
        );
    check('multi answer needs the exact set', review({'a', 'b'}).isCorrect && !review({'a'}).isCorrect && !review({'a', 'b', 'c'}).isCorrect);
  }
  check('fmtMarks drops needless decimals', fmtMarks(4) == '4' && fmtMarks(0.25) == '0.25');

  // ── New: series, images, analysis ──
  {
    final t = TestSummary.fromJson({
      'id': 't1',
      'title': 'Mock 1',
      'durationMin': 60,
      'totalMarks': '300',
      'negativeMark': '1',
      'startAt': null,
      'endAt': null,
      'state': 'OPEN',
      '_count': {'questions': 75},
      'attempt': null,
      'series': {'id': 's1', 'name': 'NEET Mock Series 2027'},
    });
    check('a test knows its series name', t.seriesName == 'NEET Mock Series 2027' && t.state == TestState.open);
    final loose = TestSummary.fromJson({
      'id': 't2', 'title': 'x', 'durationMin': 5, 'totalMarks': 1, 'negativeMark': 0, 'startAt': null, 'endAt': null,
      'state': 'ATTEMPTED', '_count': {'questions': 1}, 'attempt': {'id': 'a1', 'score': '3.00'}, 'series': null,
    });
    check('a stand-alone test has no series, and keeps its score', loose.seriesName == null && loose.score == 3.0 && loose.attemptId == 'a1');

    final pq = PaperQuestion.fromJson({
      'id': 'q', 'text': 'T', 'type': 'SINGLE', 'marks': 4, 'imageUrl': '/api/files/abc.png?exp=1&sig=2',
      'options': [{'id': 'o1', 'text': 'x'}], 'selectedOptionIds': [], 'markedForReview': false,
    });
    check('a paper question carries its picture link', pq.imageUrl == '/api/files/abc.png?exp=1&sig=2');
    final plain = PaperQuestion.fromJson({
      'id': 'q', 'text': 'T', 'type': 'SINGLE', 'marks': 4, 'imageUrl': null,
      'options': [{'id': 'o1', 'text': 'x'}], 'selectedOptionIds': [], 'markedForReview': false,
    });
    check('no picture -> null', plain.imageUrl == null);

    final r = TestResult.fromJson({
      'test': {'title': 'Mock 1', 'totalMarks': 12},
      'score': 3, 'percentage': 25, 'correct': 1, 'incorrect': 1, 'unanswered': 1, 'status': 'SUBMITTED',
      'rank': 2, 'participants': 40, 'average': '5.5', 'highest': 11,
      'subjects': [
        {'name': 'Physics', 'correct': 1, 'incorrect': 1, 'skipped': 0, 'score': 3, 'total': 8},
        {'name': 'Chemistry', 'correct': 0, 'incorrect': 0, 'skipped': 1, 'score': 0, 'total': 4},
      ],
      'review': null,
    });
    check('result carries rank / participants / average / highest', r.rank == 2 && r.participants == 40 && r.average == 5.5 && r.highest == 11);
    check('result carries the subject split', r.subjects.length == 2 && r.subjects.first.name == 'Physics' && r.subjects.first.accuracy == 0.5 && r.subjects.last.accuracy == 0.0);
    check('review stays hidden until the window closes', r.review == null);

    final old = TestResult.fromJson({
      'test': {'title': 'Old', 'totalMarks': 4},
      'score': 4, 'percentage': 100, 'correct': 1, 'incorrect': 0, 'unanswered': 0, 'status': 'SUBMITTED', 'review': null,
    });
    check('an older server reply without analysis still parses', old.rank == null && old.subjects.isEmpty);

    final rev = ReviewQuestion.fromJson({
      'text': 'q', 'marks': 4, 'explanation': 'why', 'imageUrl': '/api/files/z.jpg?x=1',
      'selectedOptionIds': ['a'], 'options': [{'id': 'a', 'text': 'A', 'isCorrect': true}],
    });
    check('a review question carries its picture and is correct', rev.imageUrl != null && rev.isCorrect);
  }

  print('\n$passed passed, $failures failed');
  if (failures > 0) throw StateError('$failures checks failed');
}

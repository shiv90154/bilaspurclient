import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/data/models.dart';
import 'package:student_app/features/tests/attempt_session.dart';

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

void main() {
  group('AttemptSession', () {
    test('single choice: tap selects, tap again clears, another tap replaces', () {
      final s = AttemptSession(paperOf([q('1')]), (_) async {});
      final one = s.paper.questions.first;
      s.select(one, '1-a');
      expect(one.selected, {'1-a'});
      s.select(one, '1-b');
      expect(one.selected, {'1-b'});
      s.select(one, '1-b');
      expect(one.selected, isEmpty);
      s.dispose();
    });

    test('multiple choice: taps toggle independently', () {
      final s = AttemptSession(paperOf([q('1', multiple: true)]), (_) async {});
      final one = s.paper.questions.first;
      s.select(one, '1-a');
      s.select(one, '1-c');
      expect(one.selected, {'1-a', '1-c'});
      s.select(one, '1-a');
      expect(one.selected, {'1-c'});
      s.dispose();
    });

    test('autosaves only changed questions after the debounce, in one request', () async {
      final saved = <List<String>>[];
      final s = AttemptSession(
        paperOf([q('1'), q('2'), q('3')]),
        (changed) async => saved.add([for (final c in changed) c.id]),
        debounce: const Duration(milliseconds: 20),
      );
      s.select(s.paper.questions[0], '1-a');
      s.select(s.paper.questions[2], '3-b');
      expect(saved, isEmpty); // still debouncing
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(saved, [
        ['1', '3'],
      ]);
      expect(s.hasUnsaved, isFalse);
      s.dispose();
    });

    test('a failed save keeps the answer queued and the next flush retries it', () async {
      var fail = true;
      final saved = <String>[];
      final s = AttemptSession(paperOf([q('1')]), (changed) async {
        if (fail) throw Exception('offline');
        saved.addAll([for (final c in changed) c.id]);
      });
      s.select(s.paper.questions.first, '1-a');
      await s.flush();
      expect(s.hasUnsaved, isTrue);
      expect(s.lastSaveError, isNotNull);

      fail = false;
      await s.flush();
      expect(saved, ['1']);
      expect(s.hasUnsaved, isFalse);
      expect(s.lastSaveError, isNull);
      s.dispose();
    });

    test('saves are serialized: a newer answer is never overtaken by an older request', () async {
      final order = <String>[];
      final gate = Completer<void>();
      var first = true;
      final s = AttemptSession(paperOf([q('1')]), (changed) async {
        final snapshot = changed.first.selected.join(',');
        if (first) {
          first = false;
          await gate.future; // the first request is slow
        }
        order.add(snapshot);
      });
      final one = s.paper.questions.first;
      s.select(one, '1-a');
      final f1 = s.flush();
      s.select(one, '1-b'); // changes while request #1 is still in flight
      final f2 = s.flush();
      gate.complete();
      await Future.wait([f1, f2]);
      expect(order.last, '1-b');
      s.dispose();
    });

    test('counts answered and marked questions', () {
      final s = AttemptSession(paperOf([q('1'), q('2')]), (_) async {});
      s.select(s.paper.questions[0], '1-a');
      s.toggleMarked(s.paper.questions[1]);
      expect((s.answered, s.markedCount), (1, 1));
      s.dispose();
    });
  });

  group('Paper clock', () {
    test('remaining time ignores a wrong phone clock', () {
      // The deadline is a server time. A phone 10 min fast (or 15 min slow) must still show ~30 min left.
      final fast = paperOf([q('1')], left: const Duration(minutes: 30), offset: const Duration(minutes: -10));
      expect(fast.remaining.inMinutes, anyOf(29, 30));
      final slow = paperOf([q('1')], left: const Duration(minutes: 30), offset: const Duration(minutes: 15));
      expect(slow.remaining.inMinutes, anyOf(29, 30));
    });

    test('never negative once the deadline has passed', () {
      expect(paperOf([q('1')], left: const Duration(minutes: -5)).remaining, Duration.zero);
    });

    test('fromJson derives the offset from serverNow', () {
      final serverNow = DateTime.now().toUtc().add(const Duration(minutes: 7));
      final p = Paper.fromJson({
        'attemptId': 'a',
        'serverNow': serverNow.toIso8601String(),
        'deadline': serverNow.add(const Duration(minutes: 30)).toIso8601String(),
        'test': {'title': 'T', 'negativeMark': 1},
        'questions': [],
      });
      expect(p.remaining.inMinutes, anyOf(29, 30));
    });
  });

  group('ReviewQuestion', () {
    ReviewQuestion review(Set<String> selected) => ReviewQuestion(
          text: 'q',
          marks: 4,
          explanation: null,
          selected: selected,
          options: const [ReviewOption('a', 'a', true), ReviewOption('b', 'b', true), ReviewOption('c', 'c', false)],
        );

    test('multi answer needs the exact set to count as correct', () {
      expect(review({'a', 'b'}).isCorrect, isTrue);
      expect(review({'a'}).isCorrect, isFalse);
      expect(review({'a', 'b', 'c'}).isCorrect, isFalse);
    });
  });

  test('fmtMarks drops needless decimals', () {
    expect(fmtMarks(4), '4');
    expect(fmtMarks(0.25), '0.25');
  });
}

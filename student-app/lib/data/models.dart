// Plain data classes mirroring the backend responses. No logic beyond parsing.

DateTime? _date(Object? v) => v == null ? null : DateTime.parse(v as String).toLocal();
double _num(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

String fmtMarks(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(2);

// ───────────── notes ─────────────

class Note {
  const Note({
    required this.id,
    required this.title,
    required this.description,
    required this.subject,
    required this.topic,
    required this.size,
    required this.version,
    required this.allowDownload,
  });

  factory Note.fromJson(Map<String, dynamic> j) => Note(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        subject: (j['subject'] as Map?)?['name'] as String?,
        topic: (j['topic'] as Map?)?['name'] as String?,
        size: j['size'] as int,
        version: j['version'] as int,
        allowDownload: j['allowDownload'] as bool,
      );

  final String id;
  final String title;
  final String? description;
  final String? subject;
  final String? topic;
  final int size;
  final int version;
  final bool allowDownload;
}

// ───────────── tests ─────────────

enum TestState { open, upcoming, inProgress, attempted, ended }

class TestSummary {
  const TestSummary({
    required this.id,
    required this.title,
    required this.durationMin,
    required this.totalMarks,
    required this.negativeMark,
    required this.questionCount,
    required this.startAt,
    required this.endAt,
    required this.state,
    required this.attemptId,
    required this.score,
  });

  factory TestSummary.fromJson(Map<String, dynamic> j) {
    final attempt = j['attempt'] as Map<String, dynamic>?;
    return TestSummary(
      id: j['id'] as String,
      title: j['title'] as String,
      durationMin: j['durationMin'] as int,
      totalMarks: _num(j['totalMarks']),
      negativeMark: _num(j['negativeMark']),
      questionCount: (j['_count'] as Map)['questions'] as int,
      startAt: _date(j['startAt']),
      endAt: _date(j['endAt']),
      state: switch (j['state']) {
        'IN_PROGRESS' => TestState.inProgress,
        'ATTEMPTED' => TestState.attempted,
        'UPCOMING' => TestState.upcoming,
        'ENDED' => TestState.ended,
        _ => TestState.open,
      },
      attemptId: attempt?['id'] as String?,
      score: attempt?['score'] == null ? null : _num(attempt!['score']),
    );
  }

  final String id;
  final String title;
  final int durationMin;
  final double totalMarks;
  final double negativeMark;
  final int questionCount;
  final DateTime? startAt;
  final DateTime? endAt;
  final TestState state;
  final String? attemptId;
  final double? score;
}

class PaperOption {
  const PaperOption(this.id, this.text);
  final String id;
  final String text;
}

class PaperQuestion {
  PaperQuestion({
    required this.id,
    required this.text,
    required this.multiple,
    required this.marks,
    required this.options,
    required this.selected,
    required this.marked,
  });

  factory PaperQuestion.fromJson(Map<String, dynamic> j) => PaperQuestion(
        id: j['id'] as String,
        text: j['text'] as String,
        multiple: j['type'] == 'MULTIPLE',
        marks: _num(j['marks']),
        options: [
          for (final o in j['options'] as List) PaperOption((o as Map)['id'] as String, o['text'] as String),
        ],
        selected: {for (final id in j['selectedOptionIds'] as List) id as String},
        marked: j['markedForReview'] as bool,
      );

  final String id;
  final String text;
  final bool multiple;
  final double marks;
  final List<PaperOption> options;
  final Set<String> selected;
  bool marked;
}

class Paper {
  Paper({
    required this.attemptId,
    required this.title,
    required this.negativeMark,
    required this.deadline,
    required this.clockOffset,
    required this.questions,
  });

  factory Paper.fromJson(Map<String, dynamic> j) {
    final serverNow = DateTime.parse(j['serverNow'] as String);
    final test = j['test'] as Map<String, dynamic>;
    return Paper(
      attemptId: j['attemptId'] as String,
      title: test['title'] as String,
      negativeMark: _num(test['negativeMark']),
      deadline: DateTime.parse(j['deadline'] as String),
      // Phone clocks drift; every countdown is measured against the server's clock.
      clockOffset: serverNow.difference(DateTime.now().toUtc()),
      questions: [for (final q in j['questions'] as List) PaperQuestion.fromJson(q as Map<String, dynamic>)],
    );
  }

  final String attemptId;
  final String title;
  final double negativeMark;
  final DateTime deadline;
  final Duration clockOffset;
  final List<PaperQuestion> questions;

  Duration get remaining {
    final left = deadline.difference(DateTime.now().toUtc().add(clockOffset));
    return left.isNegative ? Duration.zero : left;
  }
}

class ReviewOption {
  const ReviewOption(this.id, this.text, this.isCorrect);
  final String id;
  final String text;
  final bool isCorrect;
}

class ReviewQuestion {
  const ReviewQuestion({
    required this.text,
    required this.marks,
    required this.explanation,
    required this.selected,
    required this.options,
  });

  factory ReviewQuestion.fromJson(Map<String, dynamic> j) => ReviewQuestion(
        text: j['text'] as String,
        marks: _num(j['marks']),
        explanation: j['explanation'] as String?,
        selected: {for (final id in j['selectedOptionIds'] as List) id as String},
        options: [
          for (final o in j['options'] as List)
            ReviewOption((o as Map)['id'] as String, o['text'] as String, o['isCorrect'] as bool),
        ],
      );

  final String text;
  final double marks;
  final String? explanation;
  final Set<String> selected;
  final List<ReviewOption> options;

  bool get isCorrect {
    final right = {for (final o in options) if (o.isCorrect) o.id};
    return selected.length == right.length && selected.containsAll(right);
  }
}

class TestResult {
  const TestResult({
    required this.title,
    required this.score,
    required this.totalMarks,
    required this.percentage,
    required this.correct,
    required this.incorrect,
    required this.unanswered,
    required this.autoSubmitted,
    required this.review,
  });

  factory TestResult.fromJson(Map<String, dynamic> j) {
    final test = j['test'] as Map<String, dynamic>;
    final review = j['review'] as List?;
    return TestResult(
      title: test['title'] as String,
      score: _num(j['score']),
      totalMarks: _num(test['totalMarks']),
      percentage: _num(j['percentage']),
      correct: j['correct'] as int,
      incorrect: j['incorrect'] as int,
      unanswered: j['unanswered'] as int,
      autoSubmitted: j['status'] == 'AUTO_SUBMITTED',
      review: review == null
          ? null
          : [for (final r in review) ReviewQuestion.fromJson(r as Map<String, dynamic>)],
    );
  }

  final String title;
  final double score;
  final double totalMarks;
  final double percentage;
  final int correct;
  final int incorrect;
  final int unanswered;
  final bool autoSubmitted;

  /// Null until the test window is over (answers must not leak to other students).
  final List<ReviewQuestion>? review;
}

// ───────────── doubts ─────────────

enum DoubtStatus { open, assigned, answered, resolved }

DoubtStatus _doubtStatus(Object? v) => switch (v) {
      'ASSIGNED' => DoubtStatus.assigned,
      'ANSWERED' => DoubtStatus.answered,
      'RESOLVED' => DoubtStatus.resolved,
      _ => DoubtStatus.open,
    };

class Doubt {
  const Doubt({
    required this.id,
    required this.title,
    required this.status,
    required this.updatedAt,
    required this.subject,
    required this.teacher,
  });

  factory Doubt.fromJson(Map<String, dynamic> j) => Doubt(
        id: j['id'] as String,
        title: j['title'] as String,
        status: _doubtStatus(j['status']),
        updatedAt: _date(j['updatedAt'])!,
        subject: (j['subject'] as Map?)?['name'] as String?,
        teacher: (j['assignedTo'] as Map?)?['name'] as String?,
      );

  final String id;
  final String title;
  final DoubtStatus status;
  final DateTime updatedAt;
  final String? subject;
  final String? teacher;
}

class DoubtMessage {
  const DoubtMessage({required this.text, required this.sender, required this.fromStudent, required this.at});

  factory DoubtMessage.fromJson(Map<String, dynamic> j) {
    final s = j['sender'] as Map<String, dynamic>;
    return DoubtMessage(
      text: (j['text'] as String?) ?? '',
      sender: s['name'] as String,
      fromStudent: s['role'] == 'STUDENT',
      at: _date(j['createdAt'])!,
    );
  }

  final String text;
  final String sender;
  final bool fromStudent;
  final DateTime at;
}

class DoubtThread {
  const DoubtThread({required this.doubt, required this.messages});

  factory DoubtThread.fromJson(Map<String, dynamic> j) => DoubtThread(
        doubt: Doubt.fromJson(j),
        messages: [for (final m in j['messages'] as List) DoubtMessage.fromJson(m as Map<String, dynamic>)],
      );

  final Doubt doubt;
  final List<DoubtMessage> messages;
}

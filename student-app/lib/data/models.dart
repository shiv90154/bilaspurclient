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
    this.seriesName,
    this.maxLeaves = 0,
    this.writtenQuestions = 0,
    this.awaitingCheck = false,
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
      seriesName: (j['series'] as Map?)?['name'] as String?,
      maxLeaves: j['maxLeaves'] as int? ?? 0,
      writtenQuestions: j['writtenQuestions'] as int? ?? 0,
      awaitingCheck: attempt?['evaluation'] == 'PENDING',
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

  /// The test series it belongs to ("NEET Mock Series 2027"), or null for a stand-alone test.
  final String? seriesName;

  /// Times the student may leave the app mid-test; one more submits it. 0 = only counted.
  final int maxLeaves;

  /// Questions answered in writing (typed or photos), checked by a teacher.
  final int writtenQuestions;

  /// Submitted, but the teacher has not finished checking the written answers.
  final bool awaitingCheck;
}

/// A photo of a written answer, already uploaded.
class AnswerImage {
  const AnswerImage(this.id, this.url);
  factory AnswerImage.fromJson(Map<String, dynamic> j) => AnswerImage(j['id'] as String, j['url'] as String);

  final String id;

  /// Server-relative signed link (needs [absoluteUrl]).
  final String url;
}

List<AnswerImage> answerImages(Object? list) =>
    [for (final i in (list as List? ?? const [])) AnswerImage.fromJson(i as Map<String, dynamic>)];

/// What the server says after the student came back to the app mid-test.
class LeaveResult {
  const LeaveResult({required this.leaves, required this.maxLeaves, required this.submitted});
  factory LeaveResult.fromJson(Map<String, dynamic> j) => LeaveResult(
        leaves: j['leaves'] as int? ?? 0,
        maxLeaves: j['maxLeaves'] as int? ?? 0,
        submitted: j['submitted'] as bool? ?? false,
      );

  final int leaves;
  final int maxLeaves;
  final bool submitted;
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
    this.imageUrl,
    this.written = false,
    this.textAnswer = '',
    List<AnswerImage>? images,
  }) : images = images ?? [];

  factory PaperQuestion.fromJson(Map<String, dynamic> j) => PaperQuestion(
        id: j['id'] as String,
        text: j['text'] as String,
        multiple: j['type'] == 'MULTIPLE',
        written: j['type'] == 'SUBJECTIVE',
        textAnswer: j['textAnswer'] as String? ?? '',
        images: answerImages(j['images']),
        marks: _num(j['marks']),
        options: [
          for (final o in j['options'] as List) PaperOption((o as Map)['id'] as String, o['text'] as String),
        ],
        selected: {for (final id in j['selectedOptionIds'] as List) id as String},
        marked: j['markedForReview'] as bool,
        imageUrl: j['imageUrl'] as String?,
      );

  /// Server-relative signed link to the question's figure (needs [absoluteUrl]), or null.
  final String? imageUrl;
  final String id;
  final String text;
  final bool multiple;
  final double marks;
  final List<PaperOption> options;
  final Set<String> selected;
  bool marked;

  /// Answered in writing: typed text and/or photos of the answer sheet. No options.
  final bool written;
  String textAnswer;
  List<AnswerImage> images;

  bool get answered => written ? textAnswer.trim().isNotEmpty || images.isNotEmpty : selected.isNotEmpty;
}

class Paper {
  Paper({
    required this.attemptId,
    required this.title,
    required this.negativeMark,
    required this.deadline,
    required this.clockOffset,
    required this.questions,
    this.maxLeaves = 0,
    this.leaves = 0,
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
      maxLeaves: test['maxLeaves'] as int? ?? 0,
      leaves: j['leaves'] as int? ?? 0,
    );
  }

  final String attemptId;
  final int maxLeaves;
  int leaves;
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
    this.imageUrl,
    this.written = false,
    this.textAnswer,
    this.images = const [],
    this.awardedMarks,
    this.feedback,
  });

  factory ReviewQuestion.fromJson(Map<String, dynamic> j) => ReviewQuestion(
        text: j['text'] as String,
        written: j['type'] == 'SUBJECTIVE',
        textAnswer: j['textAnswer'] as String?,
        images: answerImages(j['images']),
        awardedMarks: j['awardedMarks'] == null ? null : _num(j['awardedMarks']),
        feedback: j['feedback'] as String?,
        marks: _num(j['marks']),
        explanation: j['explanation'] as String?,
        imageUrl: j['imageUrl'] as String?,
        selected: {for (final id in j['selectedOptionIds'] as List) id as String},
        options: [
          for (final o in j['options'] as List)
            ReviewOption((o as Map)['id'] as String, o['text'] as String, o['isCorrect'] as bool),
        ],
      );

  final String text;
  final double marks;
  final String? explanation;
  final String? imageUrl;
  final Set<String> selected;
  final List<ReviewOption> options;
  final bool written;
  final String? textAnswer;
  final List<AnswerImage> images;

  /// Marks the teacher gave a written answer.
  final double? awardedMarks;
  final String? feedback;

  bool get skipped => written ? (textAnswer ?? '').trim().isEmpty && images.isEmpty : selected.isEmpty;

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
    this.leftApp = false,
    this.awaitingCheck = false,
    this.rank,
    this.participants,
    this.average,
    this.highest,
    this.subjects = const [],
  });

  factory TestResult.fromJson(Map<String, dynamic> j) {
    final test = j['test'] as Map<String, dynamic>;
    final review = j['review'] as List?;
    return TestResult(
      title: test['title'] as String,
      // While written answers wait for the teacher there is no score yet.
      score: j['score'] == null ? 0 : _num(j['score']),
      totalMarks: _num(test['totalMarks']),
      percentage: j['percentage'] == null ? 0 : _num(j['percentage']),
      correct: j['correct'] as int? ?? 0,
      incorrect: j['incorrect'] as int? ?? 0,
      unanswered: j['unanswered'] as int? ?? 0,
      autoSubmitted: j['status'] == 'AUTO_SUBMITTED',
      leftApp: j['endReason'] == 'LEFT_APP',
      awaitingCheck: j['evaluation'] == 'PENDING',
      rank: j['rank'] as int?,
      participants: j['participants'] as int?,
      average: j['average'] == null ? null : _num(j['average']),
      highest: j['highest'] == null ? null : _num(j['highest']),
      subjects: [
        for (final s in (j['subjects'] as List? ?? const [])) SubjectResult.fromJson(s as Map<String, dynamic>),
      ],
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

  /// Submitted automatically because the student left the app too many times.
  final bool leftApp;

  /// Written answers are not checked yet: no score, rank or review.
  final bool awaitingCheck;

  /// Null until the test window is over (answers must not leak to other students).
  final List<ReviewQuestion>? review;

  /// Standing among everyone who finished the test (equal scores share a rank).
  final int? rank;
  final int? participants;
  final double? average;
  final double? highest;

  /// Per-subject split: where the student is strong or weak.
  final List<SubjectResult> subjects;
}

class SubjectResult {
  const SubjectResult({
    required this.name,
    required this.correct,
    required this.incorrect,
    required this.skipped,
    required this.score,
    required this.total,
  });

  factory SubjectResult.fromJson(Map<String, dynamic> j) => SubjectResult(
        name: j['name'] as String,
        correct: j['correct'] as int,
        incorrect: j['incorrect'] as int,
        skipped: j['skipped'] as int,
        score: _num(j['score']),
        total: _num(j['total']),
      );

  final String name;
  final int correct;
  final int incorrect;
  final int skipped;
  final double score;
  final double total;

  int get questions => correct + incorrect + skipped;
  double get accuracy => questions == 0 ? 0 : correct / questions;
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

// ───────────── live classes ─────────────

enum ClassState { scheduled, live, ended, cancelled }

class LiveClass {
  const LiveClass({
    required this.id,
    required this.title,
    required this.startAt,
    required this.endAt,
    required this.state,
    required this.teacher,
  });

  factory LiveClass.fromJson(Map<String, dynamic> j) => LiveClass(
        id: j['id'] as String,
        title: j['title'] as String,
        startAt: _date(j['startAt'])!,
        endAt: _date(j['endAt'])!,
        state: switch (j['status']) {
          'LIVE' => ClassState.live,
          'ENDED' => ClassState.ended,
          'CANCELLED' => ClassState.cancelled,
          _ => ClassState.scheduled,
        },
        teacher: ((j['faculty'] as Map?)?['user'] as Map?)?['name'] as String?,
      );

  final String id;
  final String title;
  final DateTime startAt;
  final DateTime endAt;
  final ClassState state;
  final String? teacher;

  bool get isLive => state == ClassState.live;

  /// The server only lets students in from 15 minutes before the start.
  bool get canJoinNow =>
      state != ClassState.cancelled && state != ClassState.ended && DateTime.now().isAfter(startAt.subtract(const Duration(minutes: 15)));
}

/// The signed-in student's own record (`GET /students/me`).
class MyProfile {
  const MyProfile({
    required this.admissionNo,
    required this.dob,
    required this.city,
    required this.address,
    required this.guardianName,
    required this.guardianPhone,
    required this.targetExam,
    required this.photoUrl,
    required this.batches,
    required this.testsTaken,
    required this.averagePercentage,
    required this.attendancePercentage,
    required this.classesAttended,
    required this.classesHeld,
    required this.doubtsAsked,
  });

  factory MyProfile.fromJson(Map<String, dynamic> j, String origin) {
    final stats = j['stats'] as Map<String, dynamic>? ?? const {};
    final photo = j['photoUrl'] as String?;
    double? pct(Object? v) => v == null ? null : _num(v);
    return MyProfile(
      admissionNo: j['admissionNo'] as String?,
      dob: j['dob'] == null ? null : DateTime.parse(j['dob'] as String),
      city: j['city'] as String?,
      address: j['address'] as String?,
      guardianName: j['guardianName'] as String?,
      guardianPhone: j['guardianPhone'] as String?,
      targetExam: (j['academic'] as Map?)?['targetExam'] as String?,
      // Signed link, valid for an hour, relative to the server origin.
      photoUrl: photo == null ? null : '$origin$photo',
      batches: [
        for (final b in (j['batches'] as List? ?? const []))
          '${(b as Map)['batch']['course']['name']} · ${b['batch']['name']}',
      ],
      testsTaken: (stats['testsTaken'] as num?)?.toInt() ?? 0,
      averagePercentage: pct(stats['averagePercentage']),
      attendancePercentage: pct(stats['attendancePercentage']),
      classesAttended: (stats['classesAttended'] as num?)?.toInt() ?? 0,
      classesHeld: (stats['classesHeld'] as num?)?.toInt() ?? 0,
      doubtsAsked: (stats['doubtsAsked'] as num?)?.toInt() ?? 0,
    );
  }

  final String? admissionNo;
  final DateTime? dob;
  final String? city;
  final String? address;
  final String? guardianName;
  final String? guardianPhone;
  final String? targetExam;
  final String? photoUrl;
  final List<String> batches;
  final int testsTaken;
  final double? averagePercentage;
  final double? attendancePercentage;
  final int classesAttended;
  final int classesHeld;
  final int doubtsAsked;
}

/// A recorded lecture (opened by its link for now).
class VideoItem {
  const VideoItem({
    required this.id,
    required this.title,
    this.description,
    this.url,
    required this.isFile,
    this.durationSec,
    required this.isDemo,
  });

  factory VideoItem.fromJson(Map<String, dynamic> j) => VideoItem(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        url: j['externalUrl'] as String?,
        isFile: j['source'] == 'file',
        durationSec: (j['durationSec'] as num?)?.toInt(),
        isDemo: j['isDemo'] == true,
      );

  final String id;
  final String title;
  final String? description;

  /// External link (YouTube / Drive), opened outside the app.
  final String? url;

  /// Our own file (a class's Zoom recording): played inside the app, where screen recording is blocked.
  final bool isFile;
  final int? durationSec;
  final bool isDemo;
}

// ───────────── course catalog ─────────────

/// One open course of the institute (GET /courses/catalog). Never carries a price: the app
/// shows what is taught, not how to buy it (Play payments policy).
class CatalogCourse {
  const CatalogCourse({
    required this.id,
    required this.name,
    required this.category,
    required this.tagline,
    required this.description,
    required this.language,
    required this.duration,
    required this.highlights,
    required this.includes,
    required this.audience,
    required this.subjects,
    required this.enrolled,
    required this.subjectCount,
    required this.topicCount,
    required this.tests,
    required this.notes,
    required this.videos,
  });

  factory CatalogCourse.fromJson(Map<String, dynamic> j) {
    final counts = j['counts'] as Map<String, dynamic>;
    List<String> strings(Object? v) => [for (final s in (v as List? ?? const [])) s as String];
    return CatalogCourse(
      id: j['id'] as String,
      name: j['name'] as String,
      category: j['category'] as String?,
      tagline: j['tagline'] as String?,
      description: j['description'] as String?,
      language: j['language'] as String?,
      duration: j['duration'] as String?,
      highlights: strings(j['highlights']),
      includes: strings(j['includes']),
      audience: strings(j['audience']),
      subjects: [
        for (final s in j['subjects'] as List)
          (name: s['name'] as String, topics: [for (final t in s['topics'] as List) t['name'] as String]),
      ],
      enrolled: j['enrolled'] as bool,
      subjectCount: counts['subjects'] as int,
      topicCount: counts['topics'] as int,
      tests: counts['tests'] as int,
      notes: counts['notes'] as int,
      videos: counts['videos'] as int,
    );
  }

  final String id;
  final String name;
  final String? category;
  final String? tagline;
  final String? description;
  final String? language;
  final String? duration;
  final List<String> highlights;
  final List<String> includes;
  final List<String> audience;
  final List<({String name, List<String> topics})> subjects;

  /// The student is in an active batch of this course.
  final bool enrolled;
  final int subjectCount;
  final int topicCount;
  final int tests;
  final int notes;
  final int videos;
}

// ───────────── my account (documents, devices, notifications, ID card, fees) ─────────────

enum DocStatus { pending, approved, rejected }

class MyDocument {
  const MyDocument({
    required this.id,
    required this.type,
    required this.fileName,
    required this.size,
    required this.status,
    required this.byStudent,
    required this.reviewNote,
    required this.createdAt,
  });

  factory MyDocument.fromJson(Map<String, dynamic> j) => MyDocument(
        id: j['id'] as String,
        type: j['type'] as String,
        fileName: j['fileName'] as String,
        size: (j['size'] as num?)?.toInt() ?? 0,
        status: switch (j['status']) {
          'PENDING' => DocStatus.pending,
          'REJECTED' => DocStatus.rejected,
          _ => DocStatus.approved,
        },
        byStudent: j['byStudent'] == true,
        reviewNote: j['reviewNote'] as String?,
        createdAt: _date(j['createdAt'])!,
      );

  final String id;
  final String type; // PHOTO | ID_PROOF | MARKSHEET | OTHER
  final String fileName;
  final int size;
  final DocStatus status;
  final bool byStudent;
  final String? reviewNote;
  final DateTime createdAt;

  String get typeLabel => switch (type) {
        'ID_PROOF' => 'ID proof',
        'MARKSHEET' => 'Marksheet',
        'PHOTO' => 'Photo',
        _ => 'Other',
      };

  /// The student may delete their own uploads until the institute approves them.
  bool get canDelete => byStudent && status != DocStatus.approved;
}

class MyDevice {
  const MyDevice({
    required this.name,
    required this.platform,
    required this.blocked,
    required this.current,
    required this.firstSeenAt,
    required this.lastSeenAt,
  });

  factory MyDevice.fromJson(Map<String, dynamic> j) => MyDevice(
        name: j['name'] as String?,
        platform: j['platform'] as String? ?? 'ANDROID',
        blocked: j['status'] == 'BLOCKED',
        current: j['current'] == true,
        firstSeenAt: _date(j['firstSeenAt'])!,
        lastSeenAt: _date(j['lastSeenAt'])!,
      );

  final String? name;
  final String platform; // ANDROID | WEB
  final bool blocked;
  final bool current;
  final DateTime firstSeenAt;
  final DateTime lastSeenAt;
}

class MyDevices {
  const MyDevices({required this.devices, required this.limit, required this.remaining});

  factory MyDevices.fromJson(Map<String, dynamic> j) => MyDevices(
        devices: [for (final d in j['devices'] as List) MyDevice.fromJson(d as Map<String, dynamic>)],
        limit: (j['limit'] as num).toInt(),
        remaining: (j['remaining'] as num).toInt(),
      );

  final List<MyDevice> devices;
  final int limit; // new devices allowed in 30 days
  final int remaining;
}

/// Push kinds the student can switch off. Class cancelled / rescheduled always arrive.
class NotifyPrefs {
  const NotifyPrefs({
    required this.classReminders,
    required this.recordings,
    required this.doubtReplies,
    required this.testResults,
  });

  factory NotifyPrefs.fromJson(Map<String, dynamic> j) => NotifyPrefs(
        classReminders: j['classReminders'] != false,
        recordings: j['recordings'] != false,
        doubtReplies: j['doubtReplies'] != false,
        testResults: j['testResults'] != false,
      );

  final bool classReminders;
  final bool recordings;
  final bool doubtReplies;
  final bool testResults;
}

class IdCard {
  const IdCard({
    required this.instituteName,
    required this.contactPhone,
    required this.name,
    required this.phone,
    required this.admissionNo,
    required this.photoUrl,
    required this.memberSince,
    required this.courses,
    required this.validTill,
    required this.verifyCode,
  });

  factory IdCard.fromJson(Map<String, dynamic> j, String origin) {
    final photo = j['photoUrl'] as String?;
    final phone = j['contactPhone'] as String?;
    return IdCard(
      instituteName: j['instituteName'] as String? ?? 'DHĪ',
      contactPhone: phone == null || phone.isEmpty ? null : phone,
      name: j['name'] as String,
      phone: j['phone'] as String? ?? '',
      admissionNo: j['admissionNo'] as String?,
      photoUrl: photo == null ? null : '$origin$photo',
      memberSince: _date(j['memberSince'])!,
      courses: [for (final c in j['courses'] as List? ?? const []) c as String],
      validTill: _date(j['validTill']),
      verifyCode: j['verifyCode'] as String,
    );
  }

  final String instituteName;
  final String? contactPhone;
  final String name;
  final String phone;
  final String? admissionNo;
  final String? photoUrl;
  final DateTime memberSince;
  final List<String> courses;
  final DateTime? validTill;
  final String verifyCode;
}

class FeePayment {
  const FeePayment({
    required this.id,
    required this.amount,
    required this.mode,
    required this.refunded,
    required this.receiptNo,
    required this.paymentRef,
    required this.paidAt,
    required this.planName,
    required this.course,
    required this.total,
    required this.discount,
  });

  factory FeePayment.fromJson(Map<String, dynamic> j) {
    final fee = j['studentFee'] as Map<String, dynamic>? ?? const {};
    final plan = fee['plan'] as Map<String, dynamic>? ?? const {};
    final batch = (plan['batch'] as Map?)?['name'] as String?;
    final course = (plan['course'] as Map?)?['name'] as String?;
    return FeePayment(
      id: j['id'] as String,
      amount: _num(j['amount']),
      mode: j['mode'] as String? ?? '',
      refunded: j['status'] == 'REFUNDED',
      receiptNo: j['receiptNo'] as String?,
      paymentRef: j['razorpayPaymentId'] as String?,
      paidAt: _date(j['approvedAt']) ?? _date(j['createdAt'])!,
      planName: plan['name'] as String? ?? 'Fee',
      course: [?course, ?batch].join(' · '),
      total: _num(fee['total']),
      discount: _num(fee['discount']),
    );
  }

  final String id;
  final double amount;
  final String mode; // RAZORPAY | CASH | UPI | ...
  final bool refunded;
  final String? receiptNo;
  final String? paymentRef;
  final DateTime paidAt;
  final String planName;
  final String course;
  final double total;
  final double discount;

  String get modeLabel => switch (mode) {
        'RAZORPAY' => 'Online',
        'CASH' => 'Cash',
        'UPI' => 'UPI',
        'BANK_TRANSFER' => 'Bank transfer',
        'CHEQUE' => 'Cheque',
        _ => mode.isEmpty ? '' : mode[0] + mode.substring(1).toLowerCase(),
      };
}

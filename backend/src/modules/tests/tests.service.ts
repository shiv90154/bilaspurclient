import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AttemptStatus, EvalStatus, QuestionType, Role, TestStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StorageService } from '../storage/storage.service.js';
import type {
  CreateTestDto,
  ListTestsQueryDto,
  SaveMarksDto,
  SetTestBatchesDto,
  SetTestQuestionsDto,
  UpdateTestDto,
} from './dto/test.dto.js';
import { grade, hasWrittenAnswer } from './grading.js';

const DETAIL_INCLUDE = {
  course: { select: { id: true, name: true } },
  series: { select: { id: true, name: true } },
  batches: { select: { batch: { select: { id: true, name: true } } } },
  questions: {
    orderBy: { position: 'asc' },
    include: {
      question: {
        select: {
          id: true,
          text: true,
          type: true,
          difficulty: true,
          topic: { select: { id: true, name: true } },
        },
      },
    },
  },
  _count: { select: { attempts: true } },
} satisfies Prisma.TestInclude;

/** Test builder for admin/faculty. Student-facing attempts live in AttemptsService. */
@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Faculty manage only the tests they created; admin sees everything. */
  private scope(user: AuthUser): Prisma.TestWhereInput {
    return user.role === Role.FACULTY ? { createdById: user.id } : {};
  }

  async list(user: AuthUser, q: ListTestsQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.TestWhereInput = {
      ...this.scope(user),
      ...(q.status && { status: q.status }),
      ...(q.seriesId && { seriesId: q.seriesId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
        include: {
          course: { select: { id: true, name: true } },
          series: { select: { id: true, name: true } },
          _count: { select: { questions: true, attempts: true, batches: true } },
        },
      }),
      this.prisma.test.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(user: AuthUser, id: string) {
    const test = await this.prisma.test.findFirst({
      where: { id, ...this.scope(user) },
      include: DETAIL_INCLUDE,
    });
    if (!test) throw new NotFoundException('Test not found');
    return test;
  }

  async create(user: AuthUser, dto: CreateTestDto) {
    this.assertWindow(dto.startAt, dto.endAt);
    await this.assertSeries(dto.seriesId);
    const test = await this.prisma.test.create({
      data: {
        title: dto.title,
        courseId: dto.courseId,
        seriesId: dto.seriesId,
        durationMin: dto.durationMin,
        negativeMark: dto.negativeMark,
        shuffleQuestions: dto.shuffleQuestions,
        shuffleOptions: dto.shuffleOptions,
        maxLeaves: dto.maxLeaves,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        createdById: user.id,
      },
    });
    await this.log(user, 'test.create', test.id);
    return test;
  }

  async update(user: AuthUser, id: string, dto: UpdateTestDto) {
    const test = await this.get(user, id);
    // Moving a test between series is only a label: allowed even after students have attempted it.
    // (validated DTO instances carry every declared field, so look only at the ones actually sent)
    const onlySeries = Object.entries(dto).every(([k, v]) => k === 'seriesId' || v === undefined);
    if (!onlySeries) this.assertEditable(test);
    await this.assertSeries(dto.seriesId);
    this.assertWindow(dto.startAt ?? test.startAt?.toISOString(), dto.endAt ?? test.endAt?.toISOString());
    const updated = await this.prisma.test.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
    });
    await this.log(user, 'test.update', id);
    return updated;
  }

  async setQuestions(user: AuthUser, id: string, dto: SetTestQuestionsDto) {
    const test = await this.get(user, id);
    this.assertEditable(test);
    const ids = dto.questions.map((q) => q.questionId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate question in list');
    const valid = await this.prisma.question.count({ where: { id: { in: ids }, active: true } });
    if (valid !== ids.length) throw new BadRequestException('Some questions do not exist or are archived');

    const totalMarks = dto.questions.reduce((sum, q) => sum + (q.marks ?? 1), 0);
    await this.prisma.$transaction([
      this.prisma.testQuestion.deleteMany({ where: { testId: id } }),
      this.prisma.testQuestion.createMany({
        data: dto.questions.map((q, i) => ({
          testId: id,
          questionId: q.questionId,
          marks: q.marks ?? 1,
          position: i,
        })),
      }),
      this.prisma.test.update({ where: { id }, data: { totalMarks } }),
    ]);
    await this.log(user, 'test.set_questions', id);
    return this.get(user, id);
  }

  async setBatches(user: AuthUser, id: string, dto: SetTestBatchesDto) {
    const test = await this.get(user, id);
    if (test.status === TestStatus.CLOSED) throw new ConflictException('Test is closed');
    const batchIds = [...new Set(dto.batchIds)];
    const found = await this.prisma.batch.count({ where: { id: { in: batchIds } } });
    if (found !== batchIds.length) throw new BadRequestException('Unknown batch in list');
    await this.prisma.$transaction([
      this.prisma.testBatch.deleteMany({ where: { testId: id } }),
      this.prisma.testBatch.createMany({ data: batchIds.map((batchId) => ({ testId: id, batchId })) }),
    ]);
    await this.log(user, 'test.set_batches', id);
    return this.get(user, id);
  }

  async publish(user: AuthUser, id: string) {
    const test = await this.get(user, id);
    if (test.status !== TestStatus.DRAFT) throw new ConflictException('Only a draft can be published');
    if (test.questions.length === 0) throw new BadRequestException('Add questions before publishing');
    // A free demo test is open to every student, so it needs no batch.
    if (test.batches.length === 0 && !test.isDemo) {
      throw new BadRequestException('Assign at least one batch (or mark it as a free demo test) before publishing');
    }
    const updated = await this.prisma.test.update({ where: { id }, data: { status: TestStatus.PUBLISHED } });
    await this.log(user, 'test.publish', id);
    return updated;
  }

  /** Free demo test on/off. Allowed at any time: it only changes who can see the test. */
  async setDemo(user: AuthUser, id: string, isDemo: boolean) {
    await this.get(user, id);
    const updated = await this.prisma.test.update({ where: { id }, data: { isDemo } });
    await this.log(user, isDemo ? 'test.demo-on' : 'test.demo-off', id);
    return updated;
  }

  async close(user: AuthUser, id: string) {
    const test = await this.get(user, id);
    if (test.status !== TestStatus.PUBLISHED) throw new ConflictException('Only a published test can be closed');
    const updated = await this.prisma.test.update({ where: { id }, data: { status: TestStatus.CLOSED } });
    await this.log(user, 'test.close', id);
    return updated;
  }

  /** Drafts without attempts can go; anything students touched stays for the record. */
  async remove(user: AuthUser, id: string) {
    const test = await this.get(user, id);
    if (test._count.attempts > 0) throw new ConflictException('Test has attempts and cannot be deleted. Close it instead.');
    await this.prisma.test.delete({ where: { id } });
    await this.log(user, 'test.delete', id);
    return { ok: true };
  }

  /** Leaderboard: best score first, ties broken by who finished faster. */
  async results(user: AuthUser, id: string) {
    const test = await this.get(user, id);
    const attempts = await this.prisma.attempt.findMany({
      where: { testId: id, status: { not: 'IN_PROGRESS' } },
      include: { student: { select: { id: true, user: { select: { name: true, phone: true } } } } },
    });
    const rows = attempts
      .map((a) => ({
        attemptId: a.id,
        studentId: a.studentId,
        name: a.student.user.name,
        phone: a.student.user.phone,
        score: Number(a.score ?? 0),
        percentage: Number(a.percentage ?? 0),
        correct: a.correct,
        incorrect: a.incorrect,
        unanswered: a.unanswered,
        backgroundHits: a.backgroundHits,
        status: a.status,
        endReason: a.endReason,
        evaluation: a.evaluation,
        timeTakenSec: a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000) : null,
      }))
      // Unchecked attempts go last: their score is only the MCQ part so far.
      .sort(
        (a, b) =>
          Number(a.evaluation === EvalStatus.PENDING) - Number(b.evaluation === EvalStatus.PENDING) ||
          b.score - a.score ||
          (a.timeTakenSec ?? Infinity) - (b.timeTakenSec ?? Infinity),
      )
      .map((r, i) => ({ rank: r.evaluation === EvalStatus.PENDING ? null : i + 1, ...r }));
    const scores = rows.filter((r) => r.evaluation !== EvalStatus.PENDING).map((r) => r.score);
    return {
      test: { id: test.id, title: test.title, totalMarks: Number(test.totalMarks) },
      summary: {
        attempts: rows.length,
        average: scores.length ? +(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2) : 0,
        highest: scores.length ? Math.max(...scores) : 0,
        lowest: scores.length ? Math.min(...scores) : 0,
        toCheck: rows.filter((r) => r.evaluation === EvalStatus.PENDING).length,
      },
      rows,
    };
  }

  private async finishedAttempt(user: AuthUser, testId: string, attemptId: string) {
    await this.get(user, testId); // ownership
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, testId, status: { not: AttemptStatus.IN_PROGRESS } },
      include: { test: true, student: { select: { userId: true, user: { select: { name: true, phone: true } } } } },
    });
    if (!attempt) throw new NotFoundException('Submitted attempt not found');
    return attempt;
  }

  private writtenRows(testId: string) {
    return this.prisma.testQuestion.findMany({
      where: { testId, question: { type: QuestionType.SUBJECTIVE } },
      orderBy: { position: 'asc' },
      select: {
        questionId: true,
        marks: true,
        question: { select: { text: true, imageKey: true, explanation: true } },
      },
    });
  }

  /** One student's written answers with the model answer, for the teacher to give marks. */
  async answerSheet(user: AuthUser, testId: string, attemptId: string) {
    const attempt = await this.finishedAttempt(user, testId, attemptId);
    const [rows, answers] = await Promise.all([
      this.writtenRows(testId),
      this.prisma.attemptAnswer.findMany({ where: { attemptId } }),
    ]);
    const answerOf = new Map(answers.map((a) => [a.questionId, a]));
    const link = (key: string, name: string) => this.storage.signedUrl(key, name, 'inline', 3600);
    return {
      attempt: {
        id: attempt.id,
        name: attempt.student.user.name,
        phone: attempt.student.user.phone,
        status: attempt.status,
        endReason: attempt.endReason,
        evaluation: attempt.evaluation,
        leaves: attempt.backgroundHits,
        submittedAt: attempt.submittedAt,
        correct: attempt.correct,
        incorrect: attempt.incorrect,
        score: Number(attempt.score ?? 0),
        checkedAt: attempt.checkedAt,
      },
      test: { id: attempt.test.id, title: attempt.test.title, totalMarks: Number(attempt.test.totalMarks) },
      questions: rows.map((r) => {
        const a = answerOf.get(r.questionId);
        return {
          questionId: r.questionId,
          text: r.question.text,
          imageUrl: r.question.imageKey ? link(r.question.imageKey, 'question-image') : null,
          modelAnswer: r.question.explanation,
          maxMarks: Number(r.marks),
          answered: hasWrittenAnswer(a),
          textAnswer: a?.textAnswer ?? null,
          images: (a?.imageKeys ?? []).map((k) => link(k, 'answer-image')),
          awardedMarks: a?.awardedMarks == null ? null : Number(a.awardedMarks),
          feedback: a?.feedback ?? null,
        };
      }),
    };
  }

  /**
   * Save the teacher's marks. With `done`, every answered written question must have marks; the
   * final score is worked out again and the student is told the result is out.
   */
  async saveMarks(user: AuthUser, testId: string, attemptId: string, dto: SaveMarksDto) {
    const attempt = await this.finishedAttempt(user, testId, attemptId);
    if (attempt.evaluation === EvalStatus.AUTO) {
      throw new ConflictException('This attempt has no written answers to check');
    }
    const written = await this.writtenRows(testId);
    const maxOf = new Map(written.map((r) => [r.questionId, Number(r.marks)]));
    for (const m of dto.marks) {
      const max = maxOf.get(m.questionId);
      if (max === undefined) throw new BadRequestException('Not a written-answer question of this test');
      if (m.awarded > max) throw new BadRequestException(`Marks cannot be more than ${max} for this question`);
    }

    await this.prisma.$transaction(
      dto.marks.map((m) =>
        this.prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: m.questionId } },
          create: {
            attemptId,
            questionId: m.questionId,
            selectedOptionIds: [],
            awardedMarks: m.awarded,
            feedback: m.feedback ?? null,
          },
          update: { awardedMarks: m.awarded, feedback: m.feedback ?? null },
        }),
      ),
    );

    if (dto.done) {
      const [rows, answers] = await Promise.all([
        this.prisma.testQuestion.findMany({
          where: { testId },
          select: {
            questionId: true,
            marks: true,
            question: { select: { type: true, options: { select: { id: true, isCorrect: true } } } },
          },
        }),
        this.prisma.attemptAnswer.findMany({ where: { attemptId } }),
      ]);
      const answerOf = new Map(answers.map((a) => [a.questionId, a]));
      const unchecked = written.filter((r) => {
        const a = answerOf.get(r.questionId);
        return hasWrittenAnswer(a) && a?.awardedMarks == null;
      }).length;
      if (unchecked > 0) throw new BadRequestException(`Give marks to every answer first (${unchecked} left)`);

      const { score } = grade(rows, answers, Number(attempt.test.negativeMark));
      const total = Number(attempt.test.totalMarks);
      const percentage = total > 0 ? Math.max(0, (score / total) * 100) : 0;
      const firstTime = attempt.evaluation === EvalStatus.PENDING;
      await this.prisma.attempt.update({
        where: { id: attemptId },
        data: {
          score: +score.toFixed(2),
          percentage: +percentage.toFixed(2),
          evaluation: EvalStatus.DONE,
          checkedAt: new Date(),
          checkedById: user.id,
        },
      });
      await this.activity.log({ actorId: user.id, action: 'attempt.checked', entity: 'attempt', entityId: attemptId });
      if (firstTime) {
        void this.notifications.sendToUsers([attempt.student.userId], {
          title: 'Test result is out',
          body: `${attempt.test.title}: your answers have been checked.`,
          data: { type: 'test_result', attemptId },
        });
      }
    }
    return this.answerSheet(user, testId, attemptId);
  }

  private assertEditable(test: { status: TestStatus; _count: { attempts: number } }) {
    if (test.status === TestStatus.CLOSED) throw new ConflictException('Test is closed');
    if (test._count.attempts > 0) {
      throw new ForbiddenException('Students have already started this test; it can no longer be edited');
    }
  }

  private async assertSeries(seriesId?: string | null) {
    if (!seriesId) return;
    const s = await this.prisma.testSeries.findFirst({ where: { id: seriesId, active: true } });
    if (!s) throw new BadRequestException('Unknown or archived test series');
  }

  private assertWindow(startAt?: string, endAt?: string) {
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      throw new BadRequestException('endAt must be after startAt');
    }
  }

  private log(user: AuthUser, action: string, entityId: string) {
    return this.activity.log({ actorId: user.id, action, entity: 'test', entityId });
  }
}

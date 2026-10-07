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
import { Role, TestStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type {
  CreateTestDto,
  ListTestsQueryDto,
  SetTestBatchesDto,
  SetTestQuestionsDto,
  UpdateTestDto,
} from './dto/test.dto.js';

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
        timeTakenSec: a.submittedAt ? Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000) : null,
      }))
      .sort((a, b) => b.score - a.score || (a.timeTakenSec ?? Infinity) - (b.timeTakenSec ?? Infinity))
      .map((r, i) => ({ rank: i + 1, ...r }));
    const scores = rows.map((r) => r.score);
    return {
      test: { id: test.id, title: test.title, totalMarks: Number(test.totalMarks) },
      summary: {
        attempts: rows.length,
        average: scores.length ? +(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2) : 0,
        highest: scores.length ? Math.max(...scores) : 0,
        lowest: scores.length ? Math.min(...scores) : 0,
      },
      rows,
    };
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AttemptStatus, EnrollmentStatus, QuestionType, TestStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { SaveAnswersDto } from './dto/test.dto.js';

/** Extra seconds accepted after the deadline so a last tap on a slow network is not lost. */
const GRACE_MS = 10_000;

/** Deterministic PRNG so a student sees the same shuffled order every time they reload. */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const rnd = seeded(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** One question, one verdict. Shared by grading and by the per-subject breakdown so they can never disagree. */
function verdict(picked: string[], rightIds: string[]): 'correct' | 'incorrect' | 'skipped' {
  if (picked.length === 0) return 'skipped';
  return sameSet(picked, rightIds) ? 'correct' : 'incorrect';
}

type AttemptWithTest = Prisma.AttemptGetPayload<{ include: { test: true } }>;

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  private async studentOf(user: AuthUser) {
    const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) throw new ForbiddenException('Only students can take tests');
    return student;
  }

  private deadline(a: AttemptWithTest): Date {
    const byDuration = a.startedAt.getTime() + a.test.durationMin * 60_000;
    const byWindow = a.test.endAt?.getTime() ?? Infinity;
    return new Date(Math.min(byDuration, byWindow));
  }

  /** Free demo tests for everyone; batch tests only for approved students of that batch. */
  private reachable(user: AuthUser, studentId: string): Prisma.TestWhereInput {
    const ownBatches: Prisma.TestWhereInput = {
      batches: { some: { batch: { students: { some: { studentId, status: EnrollmentStatus.ACTIVE } } } } },
    };
    return { OR: user.demo ? [{ isDemo: true }] : [{ isDemo: true }, ownBatches] };
  }

  /** Published tests of the student's active batches (and demo tests), with their own attempt status. */
  async available(user: AuthUser) {
    const student = await this.studentOf(user);
    const now = new Date();
    const tests = await this.prisma.test.findMany({
      where: {
        status: { in: [TestStatus.PUBLISHED, TestStatus.CLOSED] },
        ...this.reachable(user, student.id),
      },
      orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        durationMin: true,
        totalMarks: true,
        negativeMark: true,
        startAt: true,
        endAt: true,
        status: true,
        series: { select: { id: true, name: true } },
        _count: { select: { questions: true } },
        attempts: { where: { studentId: student.id }, select: { id: true, status: true, score: true } },
      },
    });
    return tests.map(({ attempts, ...t }) => {
      const mine = attempts[0] ?? null;
      const state =
        mine?.status === AttemptStatus.IN_PROGRESS
          ? 'IN_PROGRESS'
          : mine
            ? 'ATTEMPTED'
            : t.status === TestStatus.CLOSED || (t.endAt && t.endAt <= now)
              ? 'ENDED'
              : t.startAt && t.startAt > now
                ? 'UPCOMING'
                : 'OPEN';
      return { ...t, state, attempt: mine };
    });
  }

  async mine(user: AuthUser) {
    const student = await this.studentOf(user);
    return this.prisma.attempt.findMany({
      where: { studentId: student.id },
      orderBy: { startedAt: 'desc' },
      include: { test: { select: { id: true, title: true, totalMarks: true } } },
    });
  }

  /** Start, or resume an unfinished attempt. One attempt per student per test. */
  async start(user: AuthUser, testId: string) {
    const student = await this.studentOf(user);
    const test = await this.prisma.test.findFirst({
      where: {
        id: testId,
        status: TestStatus.PUBLISHED,
        ...this.reachable(user, student.id),
      },
    });
    if (!test) throw new NotFoundException('Test not available');

    const existing = await this.prisma.attempt.findUnique({
      where: { testId_studentId: { testId, studentId: student.id } },
      include: { test: true },
    });
    if (existing) {
      const settled = await this.settleIfExpired(existing);
      if (settled.status !== AttemptStatus.IN_PROGRESS) {
        throw new ConflictException({ code: 'ALREADY_ATTEMPTED', message: 'You have already attempted this test' });
      }
      return this.paper(settled);
    }

    const now = new Date();
    if (test.startAt && test.startAt > now) {
      throw new ConflictException({ code: 'TEST_NOT_STARTED', message: 'This test has not started yet' });
    }
    if (test.endAt && test.endAt <= now) {
      throw new ConflictException({ code: 'TEST_ENDED', message: 'This test has ended' });
    }

    try {
      const attempt = await this.prisma.attempt.create({
        data: { testId, studentId: student.id },
        include: { test: true },
      });
      await this.activity.log({ actorId: user.id, action: 'attempt.start', entity: 'attempt', entityId: attempt.id });
      return this.paper(attempt);
    } catch (err) {
      // Double tap: the unique (testId, studentId) wins, so resume the one that got in.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.attempt.findUniqueOrThrow({
          where: { testId_studentId: { testId, studentId: student.id } },
          include: { test: true },
        });
        return this.paper(winner);
      }
      throw err;
    }
  }

  /** The question paper: never contains `isCorrect` or explanations. */
  private async paper(attempt: AttemptWithTest) {
    const [rows, answers] = await Promise.all([
      this.prisma.testQuestion.findMany({
        where: { testId: attempt.testId },
        orderBy: { position: 'asc' },
        include: {
          question: {
            select: {
              id: true,
              text: true,
              type: true,
              imageKey: true,
              options: { orderBy: { position: 'asc' }, select: { id: true, text: true } },
            },
          },
        },
      }),
      this.prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } }),
    ]);
    const ordered = attempt.test.shuffleQuestions ? shuffled(rows, attempt.id) : rows;
    const imageTtl = Math.max(600, Math.ceil((this.deadline(attempt).getTime() - Date.now()) / 1000) + 600);
    const answerOf = new Map(answers.map((a) => [a.questionId, a]));
    return {
      attemptId: attempt.id,
      test: {
        id: attempt.test.id,
        title: attempt.test.title,
        durationMin: attempt.test.durationMin,
        totalMarks: Number(attempt.test.totalMarks),
        negativeMark: Number(attempt.test.negativeMark),
      },
      startedAt: attempt.startedAt,
      deadline: this.deadline(attempt),
      serverNow: new Date(),
      questions: ordered.map((r) => ({
        id: r.question.id,
        text: r.question.text,
        type: r.question.type,
        // Valid until shortly after the test ends, so a long test never shows a broken picture.
        imageUrl: r.question.imageKey ? this.imageLink(r.question.imageKey, imageTtl) : null,
        marks: Number(r.marks),
        options: attempt.test.shuffleOptions
          ? shuffled(r.question.options, attempt.id + r.question.id)
          : r.question.options,
        selectedOptionIds: answerOf.get(r.question.id)?.selectedOptionIds ?? [],
        markedForReview: answerOf.get(r.question.id)?.markedForReview ?? false,
      })),
    };
  }

  private async load(user: AuthUser, attemptId: string): Promise<AttemptWithTest> {
    const student = await this.studentOf(user);
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, studentId: student.id },
      include: { test: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    return attempt;
  }

  async getPaper(user: AuthUser, attemptId: string) {
    const attempt = await this.settleIfExpired(await this.load(user, attemptId));
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ConflictException({ code: 'ATTEMPT_ENDED', message: 'This attempt has ended' });
    }
    return this.paper(attempt);
  }

  /** Autosave: answers are stored as the student goes so a crash or dead battery loses nothing. */
  async saveAnswers(user: AuthUser, attemptId: string, dto: SaveAnswersDto) {
    const attempt = await this.load(user, attemptId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS || Date.now() > this.deadline(attempt).getTime() + GRACE_MS) {
      await this.settleIfExpired(attempt);
      throw new ConflictException({ code: 'ATTEMPT_ENDED', message: 'Time is up. Your answers were submitted.' });
    }

    const questions = await this.prisma.testQuestion.findMany({
      where: { testId: attempt.testId },
      select: { questionId: true, question: { select: { type: true, options: { select: { id: true } } } } },
    });
    const byId = new Map(questions.map((q) => [q.questionId, q.question]));

    for (const a of dto.answers) {
      const q = byId.get(a.questionId);
      if (!q) throw new BadRequestException('Question is not part of this test');
      const valid = new Set(q.options.map((o) => o.id));
      if (a.selectedOptionIds.some((id) => !valid.has(id))) {
        throw new BadRequestException('Option does not belong to the question');
      }
      if (q.type === QuestionType.SINGLE && a.selectedOptionIds.length > 1) {
        throw new BadRequestException('Select only one option for this question');
      }
    }

    await this.prisma.$transaction(
      dto.answers.map((a) =>
        this.prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
          create: {
            attemptId,
            questionId: a.questionId,
            selectedOptionIds: [...new Set(a.selectedOptionIds)],
            markedForReview: a.markedForReview ?? false,
          },
          update: {
            selectedOptionIds: [...new Set(a.selectedOptionIds)],
            markedForReview: a.markedForReview ?? false,
            answeredAt: new Date(),
          },
        }),
      ),
    );
    return { saved: dto.answers.length, serverNow: new Date(), deadline: this.deadline(attempt) };
  }

  /** The app reports each time it goes to the background (anti-cheat signal for staff). */
  async reportBackground(user: AuthUser, attemptId: string) {
    const attempt = await this.load(user, attemptId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) return { ok: true };
    await this.prisma.attempt.update({ where: { id: attemptId }, data: { backgroundHits: { increment: 1 } } });
    return { ok: true };
  }

  async submit(user: AuthUser, attemptId: string) {
    const attempt = await this.load(user, attemptId);
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      await this.finalize(attempt, AttemptStatus.SUBMITTED);
      await this.activity.log({ actorId: user.id, action: 'attempt.submit', entity: 'attempt', entityId: attemptId });
    }
    return this.result(user, attemptId);
  }

  /**
   * Score + (once the window is over) a per-question review with correct answers.
   * Reviewing right after submit would let early finishers leak answers to the rest of the batch.
   */
  async result(user: AuthUser, attemptId: string) {
    const attempt = await this.settleIfExpired(await this.load(user, attemptId));
    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new ConflictException({ code: 'ATTEMPT_IN_PROGRESS', message: 'Submit the test to see the result' });
    }
    const reviewOpen =
      attempt.test.status === TestStatus.CLOSED || (attempt.test.endAt !== null && attempt.test.endAt <= new Date());

    const base = {
      attemptId: attempt.id,
      test: { id: attempt.test.id, title: attempt.test.title, totalMarks: Number(attempt.test.totalMarks) },
      status: attempt.status,
      score: Number(attempt.score ?? 0),
      percentage: Number(attempt.percentage ?? 0),
      correct: attempt.correct,
      incorrect: attempt.incorrect,
      unanswered: attempt.unanswered,
      submittedAt: attempt.submittedAt,
      reviewAvailable: reviewOpen,
      ...(await this.analysis(attempt)),
    };
    if (!reviewOpen) return { ...base, review: null };

    const [rows, answers] = await Promise.all([
      this.prisma.testQuestion.findMany({
        where: { testId: attempt.testId },
        orderBy: { position: 'asc' },
        include: { question: { include: { options: { orderBy: { position: 'asc' } } } } },
      }),
      this.prisma.attemptAnswer.findMany({ where: { attemptId } }),
    ]);
    const chosen = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));
    return {
      ...base,
      review: rows.map((r) => ({
        questionId: r.questionId,
        text: r.question.text,
        marks: Number(r.marks),
        explanation: r.question.explanation,
        imageUrl: r.question.imageKey ? this.imageLink(r.question.imageKey, 3600) : null,
        selectedOptionIds: chosen.get(r.questionId) ?? [],
        options: r.question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      })),
    };
  }

  private imageLink(key: string, ttlSeconds: number) {
    return this.storage.signedUrl(key, 'question-image', 'inline', ttlSeconds);
  }

  /**
   * How the student did compared with the rest of the test, and where they are strong or weak.
   * Nothing here reveals any answer: only counts, marks and ranks.
   */
  private async analysis(attempt: AttemptWithTest) {
    const finished = { testId: attempt.testId, status: { not: AttemptStatus.IN_PROGRESS } };
    const mine = Number(attempt.score ?? 0);
    const [better, stats, rows, answers] = await Promise.all([
      this.prisma.attempt.count({ where: { ...finished, score: { gt: mine } } }),
      this.prisma.attempt.aggregate({ where: finished, _count: { _all: true }, _avg: { score: true }, _max: { score: true } }),
      this.prisma.testQuestion.findMany({
        where: { testId: attempt.testId },
        select: {
          questionId: true,
          marks: true,
          question: {
            select: {
              options: { select: { id: true, isCorrect: true } },
              topic: { select: { subject: { select: { name: true } } } },
            },
          },
        },
      }),
      this.prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } }),
    ]);
    const chosen = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));
    const negative = Number(attempt.test.negativeMark);

    const bySubject = new Map<string, { name: string; correct: number; incorrect: number; skipped: number; score: number; total: number }>();
    for (const r of rows) {
      const name = r.question.topic.subject.name;
      const row = bySubject.get(name) ?? { name, correct: 0, incorrect: 0, skipped: 0, score: 0, total: 0 };
      row.total += Number(r.marks);
      const v = verdict(chosen.get(r.questionId) ?? [], r.question.options.filter((o) => o.isCorrect).map((o) => o.id));
      if (v === 'correct') {
        row.correct++;
        row.score += Number(r.marks);
      } else if (v === 'incorrect') {
        row.incorrect++;
        row.score -= negative;
      } else row.skipped++;
      bySubject.set(name, row);
    }

    return {
      rank: better + 1, // equal scores share a rank
      participants: stats._count._all,
      average: +Number(stats._avg.score ?? 0).toFixed(2),
      highest: Number(stats._max.score ?? 0),
      subjects: [...bySubject.values()].map((s) => ({ ...s, score: +s.score.toFixed(2) })),
    };
  }

  /** Auto-submit when time ran out. Safe to call on every read. */
  private async settleIfExpired(attempt: AttemptWithTest): Promise<AttemptWithTest> {
    if (attempt.status !== AttemptStatus.IN_PROGRESS) return attempt;
    if (Date.now() <= this.deadline(attempt).getTime()) return attempt;
    await this.finalize(attempt, AttemptStatus.AUTO_SUBMITTED);
    return this.prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { test: true } });
  }

  private async finalize(attempt: AttemptWithTest, status: AttemptStatus) {
    const [rows, answers] = await Promise.all([
      this.prisma.testQuestion.findMany({
        where: { testId: attempt.testId },
        select: { questionId: true, marks: true, question: { select: { options: { select: { id: true, isCorrect: true } } } } },
      }),
      this.prisma.attemptAnswer.findMany({ where: { attemptId: attempt.id } }),
    ]);
    const chosen = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));
    const negative = Number(attempt.test.negativeMark);

    let score = 0;
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    for (const r of rows) {
      const v = verdict(chosen.get(r.questionId) ?? [], r.question.options.filter((o) => o.isCorrect).map((o) => o.id));
      if (v === 'skipped') unanswered++;
      else if (v === 'correct') {
        correct++;
        score += Number(r.marks);
      } else {
        incorrect++;
        score -= negative;
      }
    }
    const total = Number(attempt.test.totalMarks);
    const percentage = total > 0 ? Math.max(0, (score / total) * 100) : 0;

    // updateMany with the status guard makes this idempotent under concurrent submit + cron.
    await this.prisma.attempt.updateMany({
      where: { id: attempt.id, status: AttemptStatus.IN_PROGRESS },
      data: {
        status,
        submittedAt: new Date(),
        score: +score.toFixed(2),
        percentage: +percentage.toFixed(2),
        correct,
        incorrect,
        unanswered,
      },
    });
  }

  /** Students who closed the app mid-test never call submit: the clock still ends their attempt. */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweepExpired() {
    const open = await this.prisma.attempt.findMany({
      where: { status: AttemptStatus.IN_PROGRESS },
      include: { test: true },
      take: 500,
    });
    const now = Date.now();
    for (const a of open) {
      if (now > this.deadline(a).getTime()) {
        try {
          await this.finalize(a, AttemptStatus.AUTO_SUBMITTED);
        } catch (err) {
          this.logger.error(`auto-submit failed for attempt ${a.id}`, err as Error);
        }
      }
    }
  }
}

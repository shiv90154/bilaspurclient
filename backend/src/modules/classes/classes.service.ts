import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ClassStatus, ClassType, EnrollmentStatus, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { classAudience, formatClassTime } from '../notifications/class-reminders.service.js';
import { NotificationsService, type PushMessage } from '../notifications/notifications.service.js';
import type { CreateClassDto, ListClassesQueryDto, UpdateClassDto } from './dto/class.dto.js';

/** Students may enter this long before the start time. */
const JOIN_EARLY_MS = 15 * 60_000;
const MAX_SERIES = 60;
const WEEK_MS = 7 * 24 * 3600_000;

const INCLUDE = {
  batch: { select: { id: true, name: true } },
  faculty: { select: { id: true, user: { select: { name: true } } } },
  video: { select: { id: true, title: true } },
} satisfies Prisma.LiveClassInclude;

type ClassRow = Prisma.LiveClassGetPayload<{ include: typeof INCLUDE }>;

/**
 * What the clock says, regardless of the stored status (the cron only persists it).
 * Cancelled classes stay cancelled.
 */
export function effectiveStatus(c: { status: ClassStatus; startAt: Date; endAt: Date }, now = new Date()): ClassStatus {
  if (c.status === ClassStatus.CANCELLED) return c.status;
  if (now >= c.endAt) return ClassStatus.ENDED;
  if (now >= c.startAt) return ClassStatus.LIVE;
  return ClassStatus.SCHEDULED;
}

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  private scope(user: AuthUser): Prisma.LiveClassWhereInput {
    if (user.role === Role.STUDENT) {
      return {
        batch: { students: { some: { status: EnrollmentStatus.ACTIVE, student: { userId: user.id } } } },
      };
    }
    if (user.role === Role.FACULTY) {
      return {
        OR: [
          { faculty: { userId: user.id } },
          { batch: { faculty: { some: { faculty: { userId: user.id } } } } },
        ],
      };
    }
    return {};
  }

  /** Students never get the join link from a list: only from `join`, inside the time window. */
  private present(user: AuthUser, c: ClassRow) {
    const { joinUrl, meetingId: _m, ...rest } = c;
    return {
      ...rest,
      status: effectiveStatus(c),
      ...(user.role !== Role.STUDENT && { joinUrl }),
    };
  }

  async list(user: AuthUser, q: ListClassesQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.LiveClassWhereInput = {
      AND: [
        this.scope(user),
        {
          ...(q.batchId && { batchId: q.batchId }),
          ...(q.from || q.to
            ? { startAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lt: new Date(q.to) }) } }
            : {}),
          ...(q.status && this.statusFilter(q.status)),
        },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.liveClass.findMany({
        where,
        orderBy: { startAt: 'asc' },
        skip: q.skip,
        take: q.limit,
        include: INCLUDE,
      }),
      this.prisma.liveClass.count({ where }),
    ]);
    return { items: rows.map((r) => this.present(user, r)), page: q.page, limit: q.limit, total };
  }

  /** Filter on the *effective* status (by time), not the possibly stale stored one. */
  private statusFilter(status: ClassStatus): Prisma.LiveClassWhereInput {
    const now = new Date();
    switch (status) {
      case ClassStatus.CANCELLED:
        return { status: ClassStatus.CANCELLED };
      case ClassStatus.SCHEDULED:
        return { status: { not: ClassStatus.CANCELLED }, startAt: { gt: now } };
      case ClassStatus.LIVE:
        return { status: { not: ClassStatus.CANCELLED }, startAt: { lte: now }, endAt: { gt: now } };
      case ClassStatus.ENDED:
        return { status: { not: ClassStatus.CANCELLED }, endAt: { lte: now } };
    }
  }

  /** Home-screen feed: what is live now plus what starts in the next two weeks. */
  async upcoming(user: AuthUser) {
    const now = new Date();
    const rows = await this.prisma.liveClass.findMany({
      where: {
        AND: [
          this.scope(user),
          { status: { not: ClassStatus.CANCELLED }, endAt: { gt: now }, startAt: { lt: new Date(now.getTime() + 14 * 24 * 3600_000) } },
        ],
      },
      orderBy: { startAt: 'asc' },
      take: 50,
      include: INCLUDE,
    });
    return rows.map((r) => this.present(user, r));
  }

  async get(user: AuthUser, id: string) {
    const c = await this.prisma.liveClass.findFirst({ where: { id, ...this.scope(user) }, include: INCLUDE });
    if (!c) throw new NotFoundException('Class not found');
    return this.present(user, c);
  }

  async create(user: AuthUser, dto: CreateClassDto) {
    const type = (dto.type ?? ClassType.ZOOM) as ClassType;
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);
    if (end <= start) throw new BadRequestException('endAt must be after startAt');
    if (end.getTime() - start.getTime() > 12 * 3600_000) throw new BadRequestException('A class cannot be longer than 12 hours');
    if (type === ClassType.ZOOM && !dto.joinUrl) throw new BadRequestException('A Zoom/Meet class needs a joinUrl');
    if (type === ClassType.PREMIERE && !dto.videoId) throw new BadRequestException('A premiere needs a videoId');

    await this.assertBatchAccess(user, dto.batchId);
    const facultyId = await this.resolveFaculty(user, dto.facultyId);
    if (dto.videoId && !(await this.prisma.video.findUnique({ where: { id: dto.videoId } }))) {
      throw new BadRequestException('Unknown videoId');
    }

    // Weekly series: same weekday and time each week.
    const starts = [start];
    let seriesId: string | undefined;
    let rule: string | undefined;
    if (dto.repeatWeeklyUntil) {
      const until = new Date(dto.repeatWeeklyUntil);
      if (until <= start) throw new BadRequestException('repeatWeeklyUntil must be after startAt');
      for (let t = start.getTime() + WEEK_MS; t <= until.getTime(); t += WEEK_MS) starts.push(new Date(t));
      if (starts.length > MAX_SERIES) throw new BadRequestException(`A series can have at most ${MAX_SERIES} classes`);
      seriesId = randomUUID();
      rule = `FREQ=WEEKLY;UNTIL=${until.toISOString()}`;
    }
    const length = end.getTime() - start.getTime();

    // Check everything before writing anything, so a clash in week 5 does not leave 4 orphan classes.
    for (const s of starts) await this.assertNoClash(dto.batchId, facultyId, s, new Date(s.getTime() + length));

    const created = await this.prisma.$transaction(
      starts.map((s) =>
        this.prisma.liveClass.create({
          data: {
            batchId: dto.batchId,
            facultyId,
            title: dto.title,
            type,
            startAt: s,
            endAt: new Date(s.getTime() + length),
            joinUrl: dto.joinUrl,
            videoId: dto.videoId,
            seriesId,
            recurrenceRule: rule,
            createdById: user.id,
          },
          include: INCLUDE,
        }),
      ),
    );
    await this.activity.log({
      actorId: user.id,
      action: 'class.create',
      entity: 'class',
      entityId: created[0]!.id,
      meta: { count: created.length },
    });
    return { created: created.length, items: created.map((c) => this.present(user, c)) };
  }

  /** Reschedule or edit one class. Moving it re-runs the clash check. */
  async update(user: AuthUser, id: string, dto: UpdateClassDto) {
    const c = await this.manageable(user, id);
    if (c.status === ClassStatus.CANCELLED || effectiveStatus(c) === ClassStatus.ENDED) {
      throw new ConflictException('A cancelled or finished class cannot be changed');
    }
    const start = dto.startAt ? new Date(dto.startAt) : c.startAt;
    const end = dto.endAt ? new Date(dto.endAt) : c.endAt;
    if (end <= start) throw new BadRequestException('endAt must be after startAt');
    const facultyId = dto.facultyId ?? c.facultyId;
    if (dto.facultyId && user.role !== Role.ADMIN) throw new ForbiddenException('Only an admin can change the teacher');
    if (dto.startAt || dto.endAt || dto.facultyId) await this.assertNoClash(c.batchId, facultyId, start, end, id);

    const updated = await this.prisma.liveClass.update({
      where: { id },
      data: {
        title: dto.title,
        startAt: start,
        endAt: end,
        joinUrl: dto.joinUrl,
        facultyId,
        // A moved class gets a fresh reminder for its new time.
        ...(start.getTime() !== c.startAt.getTime() && { reminderSentAt: null }),
      },
      include: INCLUDE,
    });
    await this.activity.log({ actorId: user.id, action: 'class.update', entity: 'class', entityId: id });
    if (start.getTime() !== c.startAt.getTime()) {
      void this.pushToClass(id, {
        title: 'Class rescheduled',
        body: `${updated.title} is now on ${formatClassTime(start)}`,
        data: { type: 'class_rescheduled', classId: id },
      });
    }
    return this.present(user, updated);
  }

  async cancel(user: AuthUser, id: string) {
    const c = await this.manageable(user, id);
    if (effectiveStatus(c) === ClassStatus.ENDED) throw new ConflictException('This class has already ended');
    const updated = await this.prisma.liveClass.update({
      where: { id },
      data: { status: ClassStatus.CANCELLED },
      include: INCLUDE,
    });
    await this.activity.log({ actorId: user.id, action: 'class.cancel', entity: 'class', entityId: id });
    void this.pushToClass(id, {
      title: 'Class cancelled',
      body: `${updated.title} (${formatClassTime(updated.startAt)}) was cancelled`,
      data: { type: 'class_cancelled', classId: id },
    });
    return this.present(user, updated);
  }

  /**
   * Student taps Join: checks batch, time window and cancellation, records attendance and only
   * then reveals the link.
   */
  async join(user: AuthUser, id: string) {
    const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) throw new ForbiddenException('Only students join classes');
    const c = await this.prisma.liveClass.findFirst({ where: { id, ...this.scope(user) } });
    if (!c) throw new NotFoundException('Class not found');

    const status = effectiveStatus(c);
    if (status === ClassStatus.CANCELLED) throw new ConflictException({ code: 'CLASS_CANCELLED', message: 'This class was cancelled' });
    if (status === ClassStatus.ENDED) throw new ConflictException({ code: 'CLASS_ENDED', message: 'This class has ended' });
    if (Date.now() < c.startAt.getTime() - JOIN_EARLY_MS) {
      throw new ConflictException({ code: 'CLASS_NOT_OPEN', message: 'You can join 15 minutes before the class starts' });
    }

    // First join time is kept; a later rejoin only clears "left".
    await this.prisma.classAttendance.upsert({
      where: { classId_studentId: { classId: id, studentId: student.id } },
      create: { classId: id, studentId: student.id },
      update: { leftAt: null },
    });
    return { type: c.type, joinUrl: c.type === ClassType.ZOOM ? c.joinUrl : null, videoId: c.videoId, title: c.title };
  }

  async leave(user: AuthUser, id: string) {
    const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) throw new ForbiddenException('Only students join classes');
    const row = await this.prisma.classAttendance.findUnique({
      where: { classId_studentId: { classId: id, studentId: student.id } },
    });
    if (!row) return { ok: true };
    const now = new Date();
    await this.prisma.classAttendance.update({
      where: { classId_studentId: { classId: id, studentId: student.id } },
      data: { leftAt: now, durationSec: row.durationSec + Math.max(0, Math.round((now.getTime() - row.joinedAt.getTime()) / 1000)) },
    });
    return { ok: true };
  }

  /** Who attended, against who was expected (everyone active in the batch). */
  async attendance(user: AuthUser, id: string) {
    const c = await this.manageable(user, id);
    const [rows, expected] = await Promise.all([
      this.prisma.classAttendance.findMany({
        where: { classId: id },
        include: { student: { select: { id: true, user: { select: { name: true, phone: true } } } } },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.studentBatch.findMany({
        where: { batchId: c.batchId, status: EnrollmentStatus.ACTIVE },
        select: { student: { select: { id: true, user: { select: { name: true, phone: true } } } } },
      }),
    ]);
    const attended = new Set(rows.map((r) => r.studentId));
    return {
      expected: expected.length,
      attended: rows.length,
      present: rows.map((r) => ({
        studentId: r.studentId,
        name: r.student.user.name,
        phone: r.student.user.phone,
        joinedAt: r.joinedAt,
        durationSec: r.durationSec,
      })),
      absent: expected
        .filter((e) => !attended.has(e.student.id))
        .map((e) => ({ studentId: e.student.id, name: e.student.user.name, phone: e.student.user.phone })),
    };
  }

  /** Persists LIVE / ENDED so reports and filters on the stored column stay right. */
  @Cron(CronExpression.EVERY_MINUTE)
  async syncStatuses() {
    const now = new Date();
    try {
      await this.prisma.liveClass.updateMany({
        where: { status: { in: [ClassStatus.SCHEDULED, ClassStatus.LIVE] }, endAt: { lte: now } },
        data: { status: ClassStatus.ENDED },
      });
      await this.prisma.liveClass.updateMany({
        where: { status: ClassStatus.SCHEDULED, startAt: { lte: now }, endAt: { gt: now } },
        data: { status: ClassStatus.LIVE },
      });
    } catch (err) {
      this.logger.error('class status sync failed', err as Error);
    }
  }

  /** Fire-and-forget: a push problem must never fail the admin's action. */
  private async pushToClass(classId: string, message: PushMessage) {
    try {
      await this.notifications.sendToUsers(await classAudience(this.prisma, classId), message);
    } catch (err) {
      this.logger.error('class push failed', err as Error);
    }
  }

  // ───────────── guards ─────────────

  /** Admin: any class. Faculty: classes they teach. */
  private async manageable(user: AuthUser, id: string) {
    const c = await this.prisma.liveClass.findUnique({ where: { id }, include: { faculty: { select: { userId: true } } } });
    if (!c) throw new NotFoundException('Class not found');
    if (user.role === Role.FACULTY && c.faculty?.userId !== user.id) {
      throw new ForbiddenException('You can only manage your own classes');
    }
    return c;
  }

  private async assertBatchAccess(user: AuthUser, batchId: string) {
    const batch = await this.prisma.batch.findFirst({
      where: {
        id: batchId,
        active: true,
        ...(user.role === Role.FACULTY && { faculty: { some: { faculty: { userId: user.id } } } }),
      },
    });
    if (!batch) throw new BadRequestException('Unknown or inactive batch (or not your batch)');
  }

  private async resolveFaculty(user: AuthUser, facultyId?: string): Promise<string | null> {
    if (user.role === Role.FACULTY) {
      const self = await this.prisma.faculty.findUnique({ where: { userId: user.id } });
      if (!self) throw new ForbiddenException('No faculty profile');
      if (facultyId && facultyId !== self.id) throw new ForbiddenException('Only an admin can assign another teacher');
      return self.id;
    }
    if (facultyId && !(await this.prisma.faculty.findUnique({ where: { id: facultyId } }))) {
      throw new BadRequestException('Unknown facultyId');
    }
    return facultyId ?? null;
  }

  /** One teacher cannot be in two classes at once, and a batch cannot have two classes at once. */
  private async assertNoClash(batchId: string, facultyId: string | null, start: Date, end: Date, ignoreId?: string) {
    const clash = await this.prisma.liveClass.findFirst({
      where: {
        ...(ignoreId && { id: { not: ignoreId } }),
        status: { not: ClassStatus.CANCELLED },
        startAt: { lt: end },
        endAt: { gt: start },
        OR: [{ batchId }, ...(facultyId ? [{ facultyId }] : [])],
      },
      select: { title: true, startAt: true, batchId: true },
    });
    if (clash) {
      const who = clash.batchId === batchId ? 'This batch' : 'This teacher';
      throw new ConflictException({
        code: 'CLASS_CLASH',
        message: `${who} already has "${clash.title}" at ${clash.startAt.toISOString()}`,
      });
    }
  }
}

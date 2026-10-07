import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ClassStatus,
  EnquiryStatus,
  EnrollmentStatus,
  Role,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { TestsService } from '../tests/tests.service.js';
import type {
  AttendanceReportQueryDto,
  DateRangeQueryDto,
  StudentAttendanceQueryDto,
} from './dto/report.dto.js';

const DAY_MS = 24 * 3600_000;
const pct = (part: number, whole: number) => (whole ? +((part / whole) * 100).toFixed(1) : 0);

/**
 * The "basic reports" of the admin dashboard (doc 07). Each returns JSON for the page; the
 * controller turns the same rows into CSV. Faculty only see their own batches and tests.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tests: TestsService,
    private readonly activity: ActivityService,
  ) {}

  /** `to` is a calendar day, so the range runs until the end of it. */
  private range(q: DateRangeQueryDto): Prisma.DateTimeFilter | undefined {
    if (!q.from && !q.to) return undefined;
    return {
      ...(q.from && { gte: new Date(q.from) }),
      ...(q.to && { lt: new Date(new Date(q.to).getTime() + DAY_MS) }),
    };
  }

  private myBatches(user: AuthUser): Prisma.BatchWhereInput {
    return user.role === Role.FACULTY ? { faculty: { some: { faculty: { userId: user.id } } } } : {};
  }

  async testResults(user: AuthUser, testId: string) {
    return this.tests.results(user, testId);
  }

  /** Class-wise: for every class held, how many of the batch were expected and how many joined. */
  async attendance(user: AuthUser, q: AttendanceReportQueryDto) {
    const now = new Date();
    const where: Prisma.LiveClassWhereInput = {
      status: { not: ClassStatus.CANCELLED },
      startAt: { lte: now, ...this.range(q) },
      ...(q.batchId && { batchId: q.batchId }),
      ...(user.role === Role.FACULTY && {
        OR: [{ faculty: { userId: user.id } }, { batch: this.myBatches(user) }],
      }),
    };
    const classes = await this.prisma.liveClass.findMany({
      where,
      orderBy: { startAt: 'desc' },
      take: 500,
      select: {
        id: true,
        title: true,
        startAt: true,
        batchId: true,
        batch: { select: { name: true, course: { select: { name: true } } } },
        faculty: { select: { user: { select: { name: true } } } },
        _count: { select: { attendance: true } },
      },
    });
    const batchIds = [...new Set(classes.map((c) => c.batchId))];
    const enrolments = batchIds.length
      ? await this.prisma.studentBatch.findMany({
          where: { batchId: { in: batchIds }, status: EnrollmentStatus.ACTIVE, student: { deletedAt: null } },
          select: { batchId: true, joinedAt: true },
        })
      : [];

    const rows = classes.map((c) => {
      // Students who were already in the batch when the class started.
      const expected = enrolments.filter((e) => e.batchId === c.batchId && e.joinedAt <= c.startAt).length;
      const attended = c._count.attendance;
      return {
        classId: c.id,
        title: c.title,
        startAt: c.startAt,
        batch: `${c.batch.course.name} - ${c.batch.name}`,
        teacher: c.faculty?.user.name ?? null,
        expected,
        attended,
        percentage: pct(attended, Math.max(expected, attended)),
      };
    });
    const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
    const totalAttended = rows.reduce((s, r) => s + r.attended, 0);
    return {
      summary: {
        classes: rows.length,
        averagePercentage: pct(totalAttended, Math.max(totalExpected, totalAttended)),
      },
      rows,
    };
  }

  /** Student-wise for one batch: classes held since they joined, how many they attended. */
  async studentAttendance(user: AuthUser, q: StudentAttendanceQueryDto) {
    const batch = await this.prisma.batch.findFirst({
      where: { id: q.batchId, ...this.myBatches(user) },
      select: { id: true, name: true, course: { select: { name: true } } },
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const now = new Date();
    const [classes, enrolments] = await Promise.all([
      this.prisma.liveClass.findMany({
        where: { batchId: batch.id, status: { not: ClassStatus.CANCELLED }, startAt: { lte: now, ...this.range(q) } },
        select: { id: true, startAt: true },
      }),
      this.prisma.studentBatch.findMany({
        where: { batchId: batch.id, status: EnrollmentStatus.ACTIVE, student: { deletedAt: null } },
        select: {
          joinedAt: true,
          student: { select: { id: true, admissionNo: true, user: { select: { name: true, phone: true } } } },
        },
      }),
    ]);
    const attendance = classes.length
      ? await this.prisma.classAttendance.findMany({
          where: { classId: { in: classes.map((c) => c.id) } },
          select: { classId: true, studentId: true },
        })
      : [];
    const seen = new Set(attendance.map((a) => `${a.studentId}|${a.classId}`));

    const rows = enrolments
      .map((e) => {
        const held = classes.filter((c) => c.startAt >= e.joinedAt);
        const attended = held.filter((c) => seen.has(`${e.student.id}|${c.id}`)).length;
        return {
          studentId: e.student.id,
          admissionNo: e.student.admissionNo,
          name: e.student.user.name,
          phone: e.student.user.phone,
          held: held.length,
          attended,
          percentage: pct(attended, held.length),
        };
      })
      .sort((a, b) => a.percentage - b.percentage || a.name.localeCompare(b.name));
    return { batch: { id: batch.id, name: `${batch.course.name} - ${batch.name}` }, classes: classes.length, rows };
  }

  /** Enquiry funnel: how many came in, from where, for which course, and how many joined. */
  async enquiries(user: AuthUser, q: DateRangeQueryDto) {
    if (user.role !== Role.ADMIN) throw new ForbiddenException();
    const where: Prisma.EnquiryWhereInput = { createdAt: this.range(q) };
    const list = await this.prisma.enquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        source: true,
        status: true,
        followUpDate: true,
        createdAt: true,
        courseInterest: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    });
    const count = <K extends string>(key: (e: (typeof list)[number]) => K) => {
      const map = new Map<K, { total: number; converted: number }>();
      for (const e of list) {
        const k = key(e);
        const row = map.get(k) ?? { total: 0, converted: 0 };
        row.total++;
        if (e.status === EnquiryStatus.CONVERTED) row.converted++;
        map.set(k, row);
      }
      return [...map.entries()]
        .map(([name, r]) => ({ name, ...r, conversion: pct(r.converted, r.total) }))
        .sort((a, b) => b.total - a.total);
    };
    const converted = list.filter((e) => e.status === EnquiryStatus.CONVERTED).length;
    return {
      summary: { total: list.length, converted, conversion: pct(converted, list.length) },
      byStatus: Object.values(EnquiryStatus).map((status) => ({
        status,
        count: list.filter((e) => e.status === status).length,
      })),
      bySource: count((e) => e.source?.trim() || 'Not recorded'),
      byCourse: count((e) => e.courseInterest?.name ?? 'Not chosen'),
      rows: list.map((e) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        source: e.source,
        course: e.courseInterest?.name ?? null,
        status: e.status,
        followUpDate: e.followUpDate,
        assignedTo: e.assignedTo?.name ?? null,
        createdAt: e.createdAt,
      })),
    };
  }

  /** Which notes students actually open: total opens and distinct students per material. */
  async materials(user: AuthUser, q: DateRangeQueryDto) {
    const materials = await this.prisma.material.findMany({
      where: {
        status: { not: 'ARCHIVED' },
        ...(user.role === Role.FACULTY && {
          OR: [{ uploadedById: user.id }, { batches: { some: { batch: this.myBatches(user) } } }],
        }),
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        subject: { select: { name: true } },
        batches: { select: { batch: { select: { name: true } } } },
      },
    });
    const ids = materials.map((m) => m.id);
    const viewedAt = this.range(q);
    const [views, unique] = ids.length
      ? await Promise.all([
          this.prisma.materialView.groupBy({
            by: ['materialId'],
            where: { materialId: { in: ids }, ...(viewedAt && { viewedAt }) },
            _count: { _all: true },
            _max: { viewedAt: true },
          }),
          this.prisma.materialView.groupBy({
            by: ['materialId', 'studentId'],
            where: { materialId: { in: ids }, ...(viewedAt && { viewedAt }) },
          }),
        ])
      : [[], []];
    const byId = new Map(views.map((v) => [v.materialId, v]));
    const students = new Map<string, number>();
    for (const u of unique) students.set(u.materialId, (students.get(u.materialId) ?? 0) + 1);

    const rows = materials
      .map((m) => ({
        materialId: m.id,
        title: m.title,
        subject: m.subject?.name ?? null,
        batches: m.batches.map((b) => b.batch.name).join(', '),
        views: byId.get(m.id)?._count._all ?? 0,
        students: students.get(m.id) ?? 0,
        lastViewedAt: byId.get(m.id)?._max.viewedAt ?? null,
        uploadedAt: m.createdAt,
      }))
      .sort((a, b) => b.views - a.views);
    return { summary: { materials: rows.length, views: rows.reduce((s, r) => s + r.views, 0) }, rows };
  }

  /** Exports of personal data go into the audit trail. */
  logExport(user: AuthUser, report: string, meta?: Record<string, string | undefined>) {
    return this.activity.log({
      actorId: user.id,
      action: 'report.export',
      entity: 'report',
      meta: { report, ...meta },
    });
  }
}

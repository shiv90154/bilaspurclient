import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type CsvCell, istDate, istDateTime } from '../../common/csv.js';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import { hashPassword } from '../../common/password.util.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  AttemptStatus,
  ClassStatus,
  DoubtStatus,
  EnrollmentStatus,
  Role,
  SessionRevokeReason,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { escapeHtml } from '../account/otp.service.js';
import { MailService } from '../mail/mail.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { StorageService } from '../storage/storage.service.js';
import type {
  CreateStudentDto,
  ListRegistrationsQueryDto,
  ListStudentsQueryDto,
  StudentFilters,
  UpdateStudentDto,
} from './dto/student.dto.js';

const toDate = (v?: string) => (v ? new Date(v) : undefined);

const LIST_SELECT = {
  id: true,
  admissionNo: true,
  status: true,
  city: true,
  guardianName: true,
  guardianPhone: true,
  createdAt: true,
  user: { select: { id: true, name: true, phone: true, email: true } },
  batches: {
    select: {
      status: true,
      batch: { select: { id: true, name: true, course: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.StudentSelect;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
  ) {}

  /** Self-registered students: PENDING ones wait for approval (they use demo content meanwhile). */
  async registrations(q: ListRegistrationsQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      registeredVia: { not: null },
      status: q.status ?? StudentStatus.PENDING,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        orderBy: { createdAt: q.status && q.status !== StudentStatus.PENDING ? 'desc' : 'asc' },
        skip: q.skip,
        take: q.limit,
        select: {
          id: true,
          status: true,
          registeredVia: true,
          reviewNote: true,
          createdAt: true,
          user: { select: { id: true, name: true, phone: true, email: true, emailVerifiedAt: true, lastLoginAt: true } },
          requestedCourse: { select: { id: true, name: true } },
          batches: { select: { batch: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  /** Admission approved: full access from now on, in the chosen batches. */
  async approve(admin: AuthUser, id: string, batchIds: string[]) {
    const s = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      select: { status: true, user: { select: { name: true, email: true } } },
    });
    if (!s) throw new NotFoundException('Student not found');
    const unique = [...new Set(batchIds)];
    const found = await this.prisma.batch.count({ where: { id: { in: unique }, active: true } });
    if (found !== unique.length) throw new BadRequestException('One or more batches are invalid or inactive');

    await this.prisma.$transaction([
      ...unique.map((batchId) =>
        this.prisma.studentBatch.upsert({
          where: { studentId_batchId: { studentId: id, batchId } },
          create: { studentId: id, batchId },
          update: { status: 'ACTIVE' },
        }),
      ),
      this.prisma.student.update({ where: { id }, data: { status: StudentStatus.ACTIVE, reviewNote: null } }),
    ]);
    await this.activity.log({ actorId: admin.id, action: 'student.approve', entity: 'student', entityId: id, meta: { batchIds: unique } });
    void this.notify(s.user.email, s.user.name, 'Your admission is approved', [
      'Your admission has been approved. Open the app again to see your classes, notes and tests.',
    ]);
    return this.get(admin, id);
  }

  /** Registration turned down: the account is closed and the student told why (if a note is given). */
  async reject(admin: AuthUser, id: string, note?: string) {
    const s = await this.prisma.student.findFirst({
      where: { id, deletedAt: null, status: StudentStatus.PENDING },
      select: { userId: true, user: { select: { name: true, email: true } } },
    });
    if (!s) throw new NotFoundException('No pending registration with this id');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.student.update({ where: { id }, data: { status: StudentStatus.DROPPED, reviewNote: note?.trim() || null } }),
      this.prisma.session.updateMany({
        where: { userId: s.userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.USER_DISABLED },
      }),
    ]);
    await this.activity.log({ actorId: admin.id, action: 'student.reject', entity: 'student', entityId: id });
    void this.notify(s.user.email, s.user.name, 'About your registration', [
      'Your registration could not be approved.',
      ...(note?.trim() ? [`Note from the institute: ${note.trim()}`] : []),
      'For questions, contact the institute.',
    ]);
    return { id, status: StudentStatus.DROPPED };
  }

  /** Best effort email to the student; a mail problem never fails the admin's action. */
  private async notify(to: string | null, name: string, subject: string, lines: string[]) {
    if (!to || !this.mail.enabled) return;
    try {
      const { instituteName } = await this.settings.publicInfo();
      await this.mail.send({
        to,
        subject: `${instituteName}: ${subject}`,
        text: [`Hello ${name},`, '', ...lines, '', instituteName].join('\n'),
        html: `<p>Hello ${escapeHtml(name)},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}<p>${escapeHtml(instituteName)}</p>`,
      });
    } catch {
      // logged by MailService
    }
  }

  /** Faculty only see students of batches they teach; admin sees all. */
  private scope(user: AuthUser): Prisma.StudentWhereInput {
    return {
      deletedAt: null,
      ...(user.role === Role.FACULTY && {
        batches: { some: { batch: { faculty: { some: { faculty: { userId: user.id } } } } } },
      }),
    };
  }

  private listWhere(user: AuthUser, q: StudentFilters): Prisma.StudentWhereInput {
    const filters: Prisma.StudentWhereInput[] = [this.scope(user)];
    if (q.status) filters.push({ status: q.status });
    if (q.batchId) filters.push({ batches: { some: { batchId: q.batchId } } });
    if (q.courseId)
      filters.push({ batches: { some: { batch: { courseId: q.courseId } } } });
    if (q.search) {
      filters.push({
        OR: [
          { user: { name: { contains: q.search, mode: 'insensitive' } } },
          { user: { phone: { contains: q.search } } },
          { admissionNo: { contains: q.search, mode: 'insensitive' } },
        ],
      });
    }
    return { AND: filters };
  }

  async list(user: AuthUser, q: ListStudentsQueryDto): Promise<Paginated<unknown>> {
    const where = this.listWhere(user, q);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.student.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  /** Every student matching the list filters, as CSV rows (no paging). */
  async exportRows(user: AuthUser, q: StudentFilters) {
    const students = await this.prisma.student.findMany({
      where: this.listWhere(user, q),
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, phone: true, email: true, lastLoginAt: true } },
        academic: true,
        batches: { include: { batch: { select: { name: true, course: { select: { name: true } } } } } },
      },
    });
    await this.activity.log({
      actorId: user.id,
      action: 'student.export',
      entity: 'student',
      meta: { count: students.length, ...q },
    });
    const header = [
      'Admission no', 'Name', 'Phone', 'Email', 'Status', 'Gender', 'Date of birth', 'City', 'Address',
      'Guardian name', 'Guardian phone', 'Batches', 'Previous school', 'Previous class',
      'Previous marks %', 'Target exam', 'Registered on', 'Last login',
    ];
    const rows: CsvCell[][] = students.map((s) => [
      s.admissionNo, s.user.name, s.user.phone, s.user.email, s.status, s.gender,
      s.dob ? s.dob.toISOString().slice(0, 10) : '', s.city, s.address, s.guardianName, s.guardianPhone,
      s.batches.map((b) => `${b.batch.course.name} - ${b.batch.name}`).join('; '),
      s.academic?.prevSchool, s.academic?.prevClass,
      s.academic?.prevMarks != null ? Number(s.academic.prevMarks) : '',
      s.academic?.targetExam, istDate(s.createdAt), istDateTime(s.user.lastLoginAt),
    ]);
    return { header, rows };
  }

  async get(user: AuthUser, id: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, status: true, lastLoginAt: true } },
        academic: true,
        batches: { include: { batch: { include: { course: { select: { id: true, name: true } } } } } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return this.withPhoto(student);
  }

  /** The signed-in student's own profile, with a few numbers for the profile screen. */
  async me(user: AuthUser) {
    const student = await this.prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: {
        id: true,
        admissionNo: true,
        dob: true,
        gender: true,
        address: true,
        city: true,
        guardianName: true,
        guardianPhone: true,
        photoKey: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, phone: true, email: true } },
        academic: { select: { prevSchool: true, prevClass: true, targetExam: true } },
        batches: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: {
            joinedAt: true,
            batch: {
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                course: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Student profile not found');
    const { summary } = await this.records(student.id);
    return { ...this.withPhoto(student), stats: summary };
  }

  /**
   * One student's history in one place: test results, class attendance, doubts and how much
   * study material they opened. Attendance counts only classes held after they joined the batch.
   */
  async records(studentId: string) {
    const now = new Date();
    const enrolments = await this.prisma.studentBatch.findMany({
      where: { studentId },
      select: { batchId: true, joinedAt: true },
    });
    const [attempts, classes, attended, doubts, materialViews, materialsOpened] = await Promise.all([
      this.prisma.attempt.findMany({
        where: { studentId },
        orderBy: { startedAt: 'desc' },
        include: { test: { select: { id: true, title: true, totalMarks: true } } },
      }),
      enrolments.length
        ? this.prisma.liveClass.findMany({
            where: {
              status: { not: ClassStatus.CANCELLED },
              startAt: { lte: now },
              OR: enrolments.map((e) => ({ batchId: e.batchId, startAt: { gte: e.joinedAt } })),
            },
            orderBy: { startAt: 'desc' },
            take: 200,
            select: { id: true, title: true, startAt: true, batch: { select: { name: true } } },
          })
        : Promise.resolve([]),
      this.prisma.classAttendance.findMany({
        where: { studentId },
        select: { classId: true, joinedAt: true },
      }),
      this.prisma.doubt.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          subject: { select: { name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.materialView.count({ where: { studentId } }),
      this.prisma.materialView.groupBy({ by: ['materialId'], where: { studentId } }),
    ]);

    const present = new Map(attended.map((a) => [a.classId, a]));
    const finished = attempts.filter((a) => a.status !== AttemptStatus.IN_PROGRESS);
    const average = finished.length
      ? +(finished.reduce((sum, a) => sum + Number(a.percentage ?? 0), 0) / finished.length).toFixed(2)
      : null;
    const classesAttended = classes.filter((c) => present.has(c.id)).length;

    return {
      summary: {
        testsTaken: finished.length,
        averagePercentage: average,
        classesHeld: classes.length,
        classesAttended,
        attendancePercentage: classes.length
          ? +((classesAttended / classes.length) * 100).toFixed(1)
          : null,
        doubtsAsked: doubts.length,
        doubtsOpen: doubts.filter(
          (d) => d.status === DoubtStatus.OPEN || d.status === DoubtStatus.ASSIGNED,
        ).length,
        materialsOpened: materialsOpened.length,
        materialViews,
      },
      tests: attempts.map((a) => ({
        attemptId: a.id,
        testId: a.test.id,
        title: a.test.title,
        status: a.status,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        score: a.score != null ? Number(a.score) : null,
        totalMarks: Number(a.test.totalMarks),
        percentage: a.percentage != null ? Number(a.percentage) : null,
        correct: a.correct,
        incorrect: a.incorrect,
        unanswered: a.unanswered,
      })),
      attendance: classes.map((c) => ({
        classId: c.id,
        title: c.title,
        batch: c.batch.name,
        startAt: c.startAt,
        present: present.has(c.id),
        joinedAt: present.get(c.id)?.joinedAt ?? null,
      })),
      doubts: doubts.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        subject: d.subject?.name ?? null,
        messages: d._count.messages,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      })),
    };
  }

  /** Staff view of the records, limited to students they can see. */
  async recordsFor(user: AuthUser, id: string) {
    const s = await this.prisma.student.findFirst({
      where: { id, ...this.scope(user) },
      select: { id: true },
    });
    if (!s) throw new NotFoundException('Student not found');
    return this.records(id);
  }

  /** Swaps the private storage key for a short-lived link the page can show. */
  private withPhoto<T extends { photoKey: string | null }>({ photoKey, ...rest }: T) {
    return {
      ...rest,
      photoUrl: photoKey ? this.storage.signedUrl(photoKey, 'photo', 'inline', 3600) : null,
    };
  }

  async create(admin: AuthUser, dto: CreateStudentDto) {
    const batchIds = [...new Set(dto.batchIds ?? [])];
    if (batchIds.length) {
      const found = await this.prisma.batch.count({ where: { id: { in: batchIds } } });
      if (found !== batchIds.length)
        throw new BadRequestException('One or more batch ids are invalid');
    }

    const generated = dto.password ? undefined : randomBytes(9).toString('base64url');
    const passwordHash = await hashPassword(dto.password ?? generated!);

    try {
      const student = await this.prisma.student.create({
        data: {
          admissionNo: dto.admissionNo,
          dob: toDate(dto.dob),
          gender: dto.gender,
          address: dto.address,
          city: dto.city,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          notes: dto.notes,
          status: dto.status ?? StudentStatus.ACTIVE,
          user: {
            create: {
              name: dto.name,
              phone: dto.phone,
              email: dto.email,
              passwordHash,
              role: Role.STUDENT,
            },
          },
          ...(dto.academic && { academic: { create: dto.academic } }),
          ...(batchIds.length && {
            batches: { create: batchIds.map((batchId) => ({ batchId })) },
          }),
        },
        select: { id: true },
      });
      await this.activity.log({
        actorId: admin.id,
        action: 'student.create',
        entity: 'student',
        entityId: student.id,
      });
      const full = await this.get(admin, student.id);
      // The generated password is shown exactly once; only its hash is stored.
      return generated ? { ...full, temporaryPassword: generated } : full;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async update(admin: AuthUser, id: string, dto: UpdateStudentDto) {
    const existing = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Student not found');

    const { name, phone, email, academic, dob, ...profile } = dto;
    try {
      await this.prisma.student.update({
        where: { id },
        data: {
          ...profile,
          dob: toDate(dob),
          user:
            name || phone || email
              ? { update: { name, phone, email } }
              : undefined,
          ...(academic && {
            academic: { upsert: { create: academic, update: academic } },
          }),
        },
      });
    } catch (err) {
      throw this.mapError(err);
    }
    await this.activity.log({
      actorId: admin.id,
      action: 'student.update',
      entity: 'student',
      entityId: id,
      meta: dto.status ? { status: dto.status } : undefined,
    });
    return this.get(admin, id);
  }

  /** Soft delete: record is kept, login is disabled and sessions are ended. */
  async remove(admin: AuthUser, id: string) {
    const existing = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!existing) throw new NotFoundException('Student not found');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id },
        data: { deletedAt: now, status: StudentStatus.INACTIVE },
      }),
      this.prisma.user.update({
        where: { id: existing.userId },
        data: { deletedAt: now, status: UserStatus.INACTIVE },
      }),
      this.prisma.session.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.USER_DISABLED },
      }),
    ]);
    await this.activity.log({
      actorId: admin.id,
      action: 'student.delete',
      entity: 'student',
      entityId: id,
    });
    return { id, deleted: true };
  }

  async assignBatch(admin: AuthUser, id: string, batchId: string) {
    await this.assertStudent(id);
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, active: true },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (!batch.active) throw new BadRequestException('Batch is not active');

    await this.prisma.studentBatch.upsert({
      where: { studentId_batchId: { studentId: id, batchId } },
      create: { studentId: id, batchId },
      update: { status: 'ACTIVE' },
    });
    await this.activity.log({
      actorId: admin.id,
      action: 'student.assign-batch',
      entity: 'student',
      entityId: id,
      meta: { batchId },
    });
    return this.get(admin, id);
  }

  async removeBatch(admin: AuthUser, id: string, batchId: string) {
    await this.assertStudent(id);
    const { count } = await this.prisma.studentBatch.deleteMany({
      where: { studentId: id, batchId },
    });
    if (!count) throw new NotFoundException('Student is not in this batch');
    await this.activity.log({
      actorId: admin.id,
      action: 'student.remove-batch',
      entity: 'student',
      entityId: id,
      meta: { batchId },
    });
    return this.get(admin, id);
  }

  private async assertStudent(id: string) {
    const s = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!s) throw new NotFoundException('Student not found');
  }

  private mapError(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        const target = JSON.stringify(err.meta?.target ?? '');
        const field = target.includes('admission')
          ? 'admission number'
          : target.includes('email')
            ? 'email'
            : 'phone number';
        return new ConflictException(`A user with this ${field} already exists`);
      }
      if (err.code === 'P2025') return new NotFoundException('Student not found');
    }
    return err;
  }
}

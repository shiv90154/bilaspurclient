import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import { hashPassword } from '../../common/password.util.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  Role,
  SessionRevokeReason,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type {
  CreateStudentDto,
  ListStudentsQueryDto,
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
  ) {}

  /** Faculty only see students of batches they teach; admin sees all. */
  private scope(user: AuthUser): Prisma.StudentWhereInput {
    return {
      deletedAt: null,
      ...(user.role === Role.FACULTY && {
        batches: { some: { batch: { faculty: { some: { faculty: { userId: user.id } } } } } },
      }),
    };
  }

  async list(user: AuthUser, q: ListStudentsQueryDto): Promise<Paginated<unknown>> {
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
    const where: Prisma.StudentWhereInput = { AND: filters };
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
    return student;
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

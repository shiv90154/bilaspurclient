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
  UserStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type {
  CreateFacultyDto,
  ListFacultyQueryDto,
  UpdateFacultyDto,
} from './dto/faculty.dto.js';

const INCLUDE = {
  user: {
    select: { id: true, name: true, phone: true, email: true, status: true, lastLoginAt: true },
  },
  subjects: {
    select: { subject: { select: { id: true, name: true, course: { select: { id: true, name: true } } } } },
  },
  batches: {
    select: { batch: { select: { id: true, name: true, course: { select: { id: true, name: true } } } } },
  },
} satisfies Prisma.FacultyInclude;

@Injectable()
export class FacultyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(q: ListFacultyQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.FacultyWhereInput = {
      user: {
        deletedAt: null,
        ...(q.search && {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { phone: { contains: q.search } },
          ],
        }),
      },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.faculty.findMany({
        where,
        include: INCLUDE,
        orderBy: { user: { name: 'asc' } },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.faculty.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(id: string) {
    const faculty = await this.prisma.faculty.findFirst({
      where: { id, user: { deletedAt: null } },
      include: INCLUDE,
    });
    if (!faculty) throw new NotFoundException('Faculty not found');
    return faculty;
  }

  async create(admin: AuthUser, dto: CreateFacultyDto) {
    const subjectIds = [...new Set(dto.subjectIds ?? [])];
    const batchIds = [...new Set(dto.batchIds ?? [])];
    await this.assertRefs(subjectIds, batchIds);

    const generated = dto.password ? undefined : randomBytes(9).toString('base64url');
    const passwordHash = await hashPassword(dto.password ?? generated!);

    try {
      const faculty = await this.prisma.faculty.create({
        data: {
          qualification: dto.qualification,
          bio: dto.bio,
          user: {
            create: {
              name: dto.name,
              phone: dto.phone,
              email: dto.email,
              passwordHash,
              role: Role.FACULTY,
            },
          },
          subjects: { create: subjectIds.map((subjectId) => ({ subjectId })) },
          batches: { create: batchIds.map((batchId) => ({ batchId })) },
        },
        select: { id: true },
      });
      await this.activity.log({
        actorId: admin.id,
        action: 'faculty.create',
        entity: 'faculty',
        entityId: faculty.id,
      });
      const full = await this.get(faculty.id);
      // Shown exactly once; only the hash is stored.
      return generated ? { ...full, temporaryPassword: generated } : full;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async update(admin: AuthUser, id: string, dto: UpdateFacultyDto) {
    const existing = await this.get(id);
    const { name, phone, email, status, subjectIds, batchIds, ...profile } = dto;

    const subjects = subjectIds && [...new Set(subjectIds)];
    const batches = batchIds && [...new Set(batchIds)];
    await this.assertRefs(subjects ?? [], batches ?? []);

    const userChanged = name || phone || email || status;
    try {
      await this.prisma.$transaction([
        this.prisma.faculty.update({
          where: { id },
          data: {
            ...profile,
            user: userChanged ? { update: { name, phone, email, status } } : undefined,
          },
        }),
        ...(subjects
          ? [
              this.prisma.facultySubject.deleteMany({ where: { facultyId: id } }),
              this.prisma.facultySubject.createMany({
                data: subjects.map((subjectId) => ({ facultyId: id, subjectId })),
              }),
            ]
          : []),
        ...(batches
          ? [
              this.prisma.facultyBatch.deleteMany({ where: { facultyId: id } }),
              this.prisma.facultyBatch.createMany({
                data: batches.map((batchId) => ({ facultyId: id, batchId })),
              }),
            ]
          : []),
        // A disabled or blocked account must be kicked out immediately.
        ...(status && status !== UserStatus.ACTIVE
          ? [
              this.prisma.session.updateMany({
                where: { userId: existing.user.id, revokedAt: null },
                data: { revokedAt: new Date(), revokedReason: SessionRevokeReason.USER_DISABLED },
              }),
            ]
          : []),
      ]);
    } catch (err) {
      throw this.mapError(err);
    }
    await this.activity.log({
      actorId: admin.id,
      action: 'faculty.update',
      entity: 'faculty',
      entityId: id,
    });
    return this.get(id);
  }

  /** Soft delete: keeps classes/doubts history, disables login. */
  async remove(admin: AuthUser, id: string) {
    const existing = await this.get(id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: existing.user.id },
        data: { deletedAt: now, status: UserStatus.INACTIVE },
      }),
      this.prisma.session.updateMany({
        where: { userId: existing.user.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.USER_DISABLED },
      }),
    ]);
    await this.activity.log({
      actorId: admin.id,
      action: 'faculty.delete',
      entity: 'faculty',
      entityId: id,
    });
    return { id, deleted: true };
  }

  private async assertRefs(subjectIds: string[], batchIds: string[]) {
    const [subjects, batches] = await Promise.all([
      subjectIds.length
        ? this.prisma.subject.count({ where: { id: { in: subjectIds } } })
        : 0,
      batchIds.length ? this.prisma.batch.count({ where: { id: { in: batchIds } } }) : 0,
    ]);
    if (subjects !== subjectIds.length)
      throw new BadRequestException('One or more subject ids are invalid');
    if (batches !== batchIds.length)
      throw new BadRequestException('One or more batch ids are invalid');
  }

  private mapError(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        const field = JSON.stringify(err.meta?.target ?? '').includes('email')
          ? 'email'
          : 'phone number';
        return new ConflictException(`A user with this ${field} already exists`);
      }
      if (err.code === 'P2025') return new NotFoundException('Faculty not found');
    }
    return err;
  }
}

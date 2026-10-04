import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type {
  CreateBatchDto,
  ListBatchesQueryDto,
  UpdateBatchDto,
} from './dto/batch.dto.js';

const toDate = (v?: string) => (v ? new Date(v) : undefined);

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** Faculty only see batches they are assigned to; admin sees all. */
  private scope(user: AuthUser): Prisma.BatchWhereInput {
    return user.role === Role.FACULTY
      ? { faculty: { some: { faculty: { userId: user.id } } } }
      : {};
  }

  async list(
    user: AuthUser,
    q: ListBatchesQueryDto,
  ): Promise<Paginated<unknown>> {
    const where: Prisma.BatchWhereInput = {
      ...this.scope(user),
      ...(q.courseId && { courseId: q.courseId }),
      ...(q.active !== undefined && { active: q.active }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.batch.findMany({
        where,
        orderBy: [{ course: { name: 'asc' } }, { name: 'asc' }],
        skip: q.skip,
        take: q.limit,
        include: {
          course: { select: { id: true, name: true } },
          _count: { select: { students: true } },
        },
      }),
      this.prisma.batch.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(user: AuthUser, id: string) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        course: { select: { id: true, name: true } },
        faculty: {
          select: {
            faculty: {
              select: { id: true, user: { select: { id: true, name: true } } },
            },
          },
        },
        _count: { select: { students: true } },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async create(admin: AuthUser, dto: CreateBatchDto) {
    this.assertDates(dto.startDate, dto.endDate);
    try {
      const batch = await this.prisma.batch.create({
        data: {
          courseId: dto.courseId,
          name: dto.name,
          startDate: toDate(dto.startDate),
          endDate: toDate(dto.endDate),
        },
      });
      await this.activity.log({
        actorId: admin.id,
        action: 'batch.create',
        entity: 'batch',
        entityId: batch.id,
      });
      return batch;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async update(admin: AuthUser, id: string, dto: UpdateBatchDto) {
    this.assertDates(dto.startDate, dto.endDate);
    try {
      const batch = await this.prisma.batch.update({
        where: { id },
        data: {
          name: dto.name,
          active: dto.active,
          startDate: toDate(dto.startDate),
          endDate: toDate(dto.endDate),
        },
      });
      await this.activity.log({
        actorId: admin.id,
        action: 'batch.update',
        entity: 'batch',
        entityId: id,
      });
      return batch;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  archive(admin: AuthUser, id: string) {
    return this.update(admin, id, { active: false });
  }

  /** Replaces the faculty assigned to a batch. */
  async setFaculty(admin: AuthUser, id: string, facultyIds: string[]) {
    const unique = [...new Set(facultyIds)];
    const [batch, found] = await Promise.all([
      this.prisma.batch.findUnique({ where: { id }, select: { id: true } }),
      this.prisma.faculty.count({ where: { id: { in: unique } } }),
    ]);
    if (!batch) throw new NotFoundException('Batch not found');
    if (found !== unique.length)
      throw new BadRequestException('One or more faculty ids are invalid');

    await this.prisma.$transaction([
      this.prisma.facultyBatch.deleteMany({ where: { batchId: id } }),
      this.prisma.facultyBatch.createMany({
        data: unique.map((facultyId) => ({ facultyId, batchId: id })),
      }),
    ]);
    await this.activity.log({
      actorId: admin.id,
      action: 'batch.set-faculty',
      entity: 'batch',
      entityId: id,
      meta: { facultyIds: unique },
    });
    return { facultyIds: unique };
  }

  private assertDates(start?: string, end?: string) {
    if (start && end && new Date(end) < new Date(start))
      throw new BadRequestException('endDate cannot be before startDate');
  }

  private mapError(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002')
        return new ConflictException(
          'A batch with this name already exists in the course',
        );
      if (err.code === 'P2025') return new NotFoundException('Batch not found');
      if (err.code === 'P2003')
        return new BadRequestException('Course does not exist');
    }
    return err;
  }
}

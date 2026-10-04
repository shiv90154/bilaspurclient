import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type {
  CreateCourseDto,
  ListCoursesQueryDto,
  UpdateCourseDto,
} from './dto/course.dto.js';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(q: ListCoursesQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.CourseWhereInput = {
      ...(q.active !== undefined && { active: q.active }),
      ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: q.skip,
        take: q.limit,
        include: { _count: { select: { batches: true } } },
      }),
      this.prisma.course.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { batches: { orderBy: { name: 'asc' } } },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(admin: AuthUser, dto: CreateCourseDto) {
    try {
      const course = await this.prisma.course.create({ data: dto });
      await this.activity.log({
        actorId: admin.id,
        action: 'course.create',
        entity: 'course',
        entityId: course.id,
      });
      return course;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async update(admin: AuthUser, id: string, dto: UpdateCourseDto) {
    try {
      const course = await this.prisma.course.update({
        where: { id },
        data: dto,
      });
      await this.activity.log({
        actorId: admin.id,
        action: 'course.update',
        entity: 'course',
        entityId: id,
      });
      return course;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Courses are never hard-deleted (batches/fees reference them): archive. */
  async archive(admin: AuthUser, id: string) {
    const course = await this.update(admin, id, { active: false });
    await this.prisma.batch.updateMany({
      where: { courseId: id },
      data: { active: false },
    });
    return course;
  }

  private mapError(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002')
        return new ConflictException('A course with this name already exists');
      if (err.code === 'P2025') return new NotFoundException('Course not found');
    }
    return err;
  }
}

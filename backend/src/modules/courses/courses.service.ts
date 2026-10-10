import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ContentStatus, EnrollmentStatus, TestStatus, VideoStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type {
  CoursePageDto,
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

  /**
   * Every open course for the student app, so students see what else the institute teaches.
   * Play payments policy: no price, fee plan or way to buy is sent here, and the app shows none.
   * `enrolled` = the student is in an active batch of that course.
   */
  async catalog(user: AuthUser) {
    const [courses, mine] = await Promise.all([
      this.prisma.course.findMany({
        where: { active: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          tagline: true,
          language: true,
          duration: true,
          highlights: true,
          includes: true,
          audience: true,
          subjects: {
            orderBy: { name: 'asc' },
            select: { name: true, topics: { orderBy: { name: 'asc' }, select: { name: true } } },
          },
        },
      }),
      this.prisma.studentBatch.findMany({
        where: {
          status: EnrollmentStatus.ACTIVE,
          student: { userId: user.id, deletedAt: null },
          batch: { active: true },
        },
        select: { batch: { select: { courseId: true } } },
      }),
    ]);
    const ids = courses.map((c) => c.id);
    const ofCourse = { batches: { some: { batch: { courseId: { in: ids } } } } };
    const [tests, notes, videos] = await Promise.all([
      this.prisma.test.groupBy({
        by: ['courseId'],
        where: { courseId: { in: ids }, status: { not: TestStatus.DRAFT } },
        _count: { _all: true },
      }),
      this.prisma.material.findMany({
        where: { status: ContentStatus.PUBLISHED, ...ofCourse },
        select: { batches: { select: { batch: { select: { courseId: true } } } } },
      }),
      this.prisma.video.findMany({
        where: { status: VideoStatus.READY, ...ofCourse },
        select: { batches: { select: { batch: { select: { courseId: true } } } } },
      }),
    ]);
    // A note shared with two batches of one course counts once for that course.
    const perCourse = (rows: { batches: { batch: { courseId: string } }[] }[]) => {
      const n = new Map<string, number>();
      for (const r of rows) for (const id of new Set(r.batches.map((b) => b.batch.courseId))) n.set(id, (n.get(id) ?? 0) + 1);
      return n;
    };
    const noteCount = perCourse(notes);
    const videoCount = perCourse(videos);
    const testCount = new Map(tests.map((t) => [t.courseId, t._count._all]));
    const enrolled = new Set(mine.map((m) => m.batch.courseId));

    return courses
      .map((c) => ({
        ...c,
        category: c.category ?? null,
        enrolled: enrolled.has(c.id),
        counts: {
          subjects: c.subjects.length,
          topics: c.subjects.reduce((n, s) => n + s.topics.length, 0),
          tests: testCount.get(c.id) ?? 0,
          notes: noteCount.get(c.id) ?? 0,
          videos: videoCount.get(c.id) ?? 0,
        },
      }))
      .sort((a, b) => Number(b.enrolled) - Number(a.enrolled));
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
      const course = await this.prisma.course.create({ data: { ...dto, ...cleanPage(dto) } });
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
        data: { ...dto, ...cleanPage(dto) },
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

/** Trims the page texts, drops empty lines and stores FAQs as plain JSON. */
function cleanPage(dto: CoursePageDto) {
  const lines = (v?: string[]) => v?.map((x) => x.trim()).filter(Boolean);
  const text = (v?: string) => (v === undefined ? undefined : v.trim() || null);
  return {
    category: text(dto.category),
    tagline: text(dto.tagline),
    language: text(dto.language),
    duration: text(dto.duration),
    highlights: lines(dto.highlights),
    includes: lines(dto.includes),
    audience: lines(dto.audience),
    faqs:
      dto.faqs === undefined
        ? undefined
        : (dto.faqs.map((f) => ({ q: f.q.trim(), a: f.a.trim() })) as Prisma.InputJsonValue),
  };
}

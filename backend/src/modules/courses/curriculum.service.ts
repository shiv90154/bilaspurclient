import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';

/** Subjects (per course) and topics (per subject): the tree questions, notes and videos hang off. */
@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  listSubjects(courseId?: string) {
    return this.prisma.subject.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: [{ courseId: 'asc' }, { name: 'asc' }],
      include: {
        topics: { orderBy: { name: 'asc' } },
        course: { select: { id: true, name: true } },
      },
    });
  }

  createSubject(admin: AuthUser, courseId: string, name: string) {
    return this.run(async () => {
      const s = await this.prisma.subject.create({ data: { courseId, name } });
      await this.log(admin, 'subject.create', 'subject', s.id);
      return s;
    }, 'Subject');
  }

  renameSubject(admin: AuthUser, id: string, name: string) {
    return this.run(async () => {
      const s = await this.prisma.subject.update({ where: { id }, data: { name } });
      await this.log(admin, 'subject.update', 'subject', id);
      return s;
    }, 'Subject');
  }

  deleteSubject(admin: AuthUser, id: string) {
    return this.run(async () => {
      await this.prisma.subject.delete({ where: { id } });
      await this.log(admin, 'subject.delete', 'subject', id);
      return { ok: true };
    }, 'Subject');
  }

  createTopic(admin: AuthUser, subjectId: string, name: string) {
    return this.run(async () => {
      const t = await this.prisma.topic.create({ data: { subjectId, name } });
      await this.log(admin, 'topic.create', 'topic', t.id);
      return t;
    }, 'Topic');
  }

  renameTopic(admin: AuthUser, id: string, name: string) {
    return this.run(async () => {
      const t = await this.prisma.topic.update({ where: { id }, data: { name } });
      await this.log(admin, 'topic.update', 'topic', id);
      return t;
    }, 'Topic');
  }

  deleteTopic(admin: AuthUser, id: string) {
    return this.run(async () => {
      await this.prisma.topic.delete({ where: { id } });
      await this.log(admin, 'topic.delete', 'topic', id);
      return { ok: true };
    }, 'Topic');
  }

  private log(user: AuthUser, action: string, entity: string, entityId: string) {
    return this.activity.log({ actorId: user.id, action, entity, entityId });
  }

  private async run<T>(fn: () => Promise<T>, label: string): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002')
          throw new ConflictException(`${label} with this name already exists`);
        if (err.code === 'P2025') throw new NotFoundException(`${label} not found`);
        if (err.code === 'P2003')
          throw new ConflictException(`${label}: parent not found or still in use`);
      }
      throw err;
    }
  }
}

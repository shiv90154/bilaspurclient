import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DoubtStatus, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateDoubtDto, ListDoubtsQueryDto } from './dto/doubt.dto.js';

const LIST_INCLUDE = {
  student: { select: { id: true, user: { select: { name: true, phone: true } } } },
  subject: { select: { id: true, name: true } },
  topic: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
} satisfies Prisma.DoubtInclude;

@Injectable()
export class DoubtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Student: own doubts. Faculty: assigned to them, or unassigned in a batch they teach. Admin: all. */
  private scope(user: AuthUser): Prisma.DoubtWhereInput {
    if (user.role === Role.STUDENT) return { student: { userId: user.id } };
    if (user.role === Role.FACULTY) {
      return {
        OR: [
          { assignedToId: user.id },
          {
            assignedToId: null,
            batch: { faculty: { some: { faculty: { userId: user.id } } } },
          },
        ],
      };
    }
    return {};
  }

  async list(user: AuthUser, q: ListDoubtsQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.DoubtWhereInput = {
      AND: [
        this.scope(user),
        {
          ...(q.status && { status: q.status }),
          ...(q.batchId && { batchId: q.batchId }),
          ...(q.subjectId && { subjectId: q.subjectId }),
        },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.doubt.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: q.skip,
        take: q.limit,
        include: LIST_INCLUDE,
      }),
      this.prisma.doubt.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(user: AuthUser, id: string) {
    const doubt = await this.prisma.doubt.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        ...LIST_INCLUDE,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!doubt) throw new NotFoundException('Doubt not found');
    return doubt;
  }

  async create(user: AuthUser, dto: CreateDoubtDto) {
    const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
    if (!student) throw new ForbiddenException('Only students can raise doubts');
    if (user.demo) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'DEMO_ACCOUNT',
        message: 'Doubts open once the institute approves your admission.',
      });
    }
    if (dto.batchId) {
      const enrolled = await this.prisma.studentBatch.findUnique({
        where: { studentId_batchId: { studentId: student.id, batchId: dto.batchId } },
      });
      if (!enrolled) throw new BadRequestException('You are not enrolled in this batch');
    }
    const doubt = await this.prisma.doubt.create({
      data: {
        studentId: student.id,
        title: dto.title,
        batchId: dto.batchId,
        subjectId: dto.subjectId,
        topicId: dto.topicId,
        classId: dto.classId,
        classTimestamp: dto.classTimestamp,
        messages: { create: { senderId: user.id, text: dto.text } },
      },
      include: LIST_INCLUDE,
    });
    await this.activity.log({
      actorId: user.id,
      action: 'doubt.create',
      entity: 'doubt',
      entityId: doubt.id,
    });
    return doubt;
  }

  /** Student follow-up or faculty/admin answer. Status moves automatically with who spoke. */
  async postMessage(user: AuthUser, id: string, text: string) {
    const doubt = await this.get(user, id);
    if (doubt.status === DoubtStatus.RESOLVED) {
      throw new BadRequestException('This doubt is resolved. Reopen it to reply.');
    }
    const status =
      user.role === Role.STUDENT
        ? doubt.assignedToId
          ? DoubtStatus.ASSIGNED
          : DoubtStatus.OPEN
        : DoubtStatus.ANSWERED;
    const [message] = await this.prisma.$transaction([
      this.prisma.doubtMessage.create({
        data: { doubtId: id, senderId: user.id, text },
        include: { sender: { select: { id: true, name: true, role: true } } },
      }),
      this.prisma.doubt.update({
        where: { id },
        data: {
          status,
          // A faculty member who answers an unassigned doubt takes it.
          ...(user.role === Role.FACULTY && !doubt.assignedToId && { assignedToId: user.id }),
        },
      }),
    ]);
    // Staff answered -> tell the student; student followed up -> tell whoever owns the doubt.
    const recipient =
      user.role === Role.STUDENT
        ? doubt.assignedToId
        : (await this.prisma.student.findUnique({ where: { id: doubt.studentId }, select: { userId: true } }))?.userId;
    if (recipient && recipient !== user.id) {
      void this.notifications.sendToUsers([recipient], {
        title: user.role === Role.STUDENT ? `${user.name} replied` : 'Your doubt has an answer',
        body: doubt.title,
        data: { type: 'doubt_reply', doubtId: id },
      });
    }
    return message;
  }

  async assign(admin: AuthUser, id: string, facultyUserId: string) {
    const faculty = await this.prisma.faculty.findUnique({ where: { userId: facultyUserId } });
    if (!faculty) throw new BadRequestException('User is not a faculty member');
    await this.get(admin, id);
    const doubt = await this.prisma.doubt.update({
      where: { id },
      data: { assignedToId: facultyUserId, status: DoubtStatus.ASSIGNED },
      include: LIST_INCLUDE,
    });
    await this.activity.log({
      actorId: admin.id,
      action: 'doubt.assign',
      entity: 'doubt',
      entityId: id,
    });
    return doubt;
  }

  async setResolved(user: AuthUser, id: string, resolved: boolean) {
    await this.get(user, id);
    const doubt = await this.prisma.doubt.update({
      where: { id },
      data: resolved
        ? { status: DoubtStatus.RESOLVED, resolvedAt: new Date() }
        : { status: DoubtStatus.OPEN, resolvedAt: null },
      include: LIST_INCLUDE,
    });
    await this.activity.log({
      actorId: user.id,
      action: resolved ? 'doubt.resolve' : 'doubt.reopen',
      entity: 'doubt',
      entityId: id,
    });
    return doubt;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EnquiryStatus, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { StudentsService } from '../students/students.service.js';
import type {
  ConvertEnquiryDto,
  CreateEnquiryDto,
  ListEnquiriesQueryDto,
  UpdateEnquiryDto,
} from './dto/enquiry.dto.js';

const toDate = (v?: string) => (v ? new Date(v) : undefined);

const INCLUDE = {
  courseInterest: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.EnquiryInclude;

@Injectable()
export class EnquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly students: StudentsService,
  ) {}

  async list(q: ListEnquiriesQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.EnquiryWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.followUpBefore && { followUpDate: { lte: new Date(q.followUpBefore) } }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { phone: { contains: q.search } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enquiry.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ followUpDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.enquiry.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(id: string) {
    const enquiry = await this.prisma.enquiry.findUnique({ where: { id }, include: INCLUDE });
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    return enquiry;
  }

  async create(actor: AuthUser, dto: CreateEnquiryDto) {
    await this.assertRefs(dto.courseInterestId, dto.assignedToId);
    const enquiry = await this.prisma.enquiry.create({
      data: { ...dto, followUpDate: toDate(dto.followUpDate) },
      include: INCLUDE,
    });
    await this.activity.log({
      actorId: actor.id,
      action: 'enquiry.create',
      entity: 'enquiry',
      entityId: enquiry.id,
    });
    return enquiry;
  }

  async update(actor: AuthUser, id: string, dto: UpdateEnquiryDto) {
    if (dto.status === EnquiryStatus.CONVERTED)
      throw new BadRequestException('Use the convert endpoint to mark an enquiry converted');
    await this.assertRefs(dto.courseInterestId, dto.assignedToId);
    try {
      const enquiry = await this.prisma.enquiry.update({
        where: { id },
        data: { ...dto, followUpDate: toDate(dto.followUpDate) },
        include: INCLUDE,
      });
      await this.activity.log({
        actorId: actor.id,
        action: 'enquiry.update',
        entity: 'enquiry',
        entityId: id,
        meta: dto.status ? { status: dto.status } : undefined,
      });
      return enquiry;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')
        throw new NotFoundException('Enquiry not found');
      throw err;
    }
  }

  async remove(actor: AuthUser, id: string) {
    const enquiry = await this.get(id);
    if (enquiry.convertedStudentId)
      throw new ConflictException('A converted enquiry cannot be deleted');
    await this.prisma.enquiry.delete({ where: { id } });
    await this.activity.log({
      actorId: actor.id,
      action: 'enquiry.delete',
      entity: 'enquiry',
      entityId: id,
    });
    return { id, deleted: true };
  }

  /** Enquiry → student: creates the login + student record and links them. */
  async convert(admin: AuthUser, id: string, dto: ConvertEnquiryDto) {
    const enquiry = await this.get(id);
    if (enquiry.convertedStudentId)
      throw new ConflictException('Enquiry is already converted');

    const student = await this.students.create(admin, {
      name: enquiry.name,
      phone: enquiry.phone,
      email: enquiry.email ?? undefined,
      password: dto.password,
      batchIds: dto.batchId ? [dto.batchId] : undefined,
    });

    await this.prisma.enquiry.update({
      where: { id },
      data: { status: EnquiryStatus.CONVERTED, convertedStudentId: student.id },
    });
    await this.activity.log({
      actorId: admin.id,
      action: 'enquiry.convert',
      entity: 'enquiry',
      entityId: id,
      meta: { studentId: student.id },
    });
    return student;
  }

  private async assertRefs(courseId?: string, userId?: string) {
    if (courseId) {
      const c = await this.prisma.course.count({ where: { id: courseId } });
      if (!c) throw new BadRequestException('Course does not exist');
    }
    if (userId) {
      const u = await this.prisma.user.count({
        where: { id: userId, deletedAt: null, role: { in: [Role.ADMIN, Role.FACULTY] } },
      });
      if (!u) throw new BadRequestException('Assignee must be an active admin or faculty user');
    }
  }
}

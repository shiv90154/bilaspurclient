import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { EnrollmentStatus, Role, VideoStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type { CreateVideoDto, ListVideosQueryDto, UpdateVideoDto } from './dto/video.dto.js';

const SELECT = {
  id: true,
  title: true,
  description: true,
  externalUrl: true,
  isDemo: true,
  createdAt: true,
  subject: { select: { id: true, name: true } },
  batches: { select: { batch: { select: { id: true, name: true } } } },
} satisfies Prisma.VideoSelect;

/**
 * Recorded lectures, link based for now (YouTube unlisted / Drive). Free demo videos are open to
 * every student; others only to their batches. Uploads + encrypted HLS come later (doc 11).
 */
@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private scope(user: AuthUser): Prisma.VideoWhereInput {
    if (user.role === Role.STUDENT) {
      const ownBatches: Prisma.VideoWhereInput = {
        batches: { some: { batch: { students: { some: { status: EnrollmentStatus.ACTIVE, student: { userId: user.id } } } } } },
      };
      return { status: VideoStatus.READY, OR: user.demo ? [{ isDemo: true }] : [{ isDemo: true }, ownBatches] };
    }
    if (user.role === Role.FACULTY) {
      return {
        OR: [
          { uploadedById: user.id },
          { batches: { some: { batch: { faculty: { some: { faculty: { userId: user.id } } } } } } },
        ],
      };
    }
    return {};
  }

  async list(user: AuthUser, q: ListVideosQueryDto): Promise<Paginated<unknown>> {
    const where = this.scope(user);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.video.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.limit, select: SELECT }),
      this.prisma.video.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async create(user: AuthUser, dto: CreateVideoDto) {
    await this.assertBatches(dto.batchIds);
    const video = await this.prisma.video.create({
      data: {
        title: dto.title,
        description: dto.description,
        externalUrl: dto.url,
        subjectId: dto.subjectId,
        isDemo: dto.isDemo ?? false,
        status: VideoStatus.READY,
        uploadedById: user.id,
        batches: { create: [...new Set(dto.batchIds ?? [])].map((batchId) => ({ batchId })) },
      },
      select: SELECT,
    });
    await this.log(user, 'video.create', video.id);
    return video;
  }

  async update(user: AuthUser, id: string, dto: UpdateVideoDto) {
    await this.manageable(user, id);
    await this.assertBatches(dto.batchIds);
    const { batchIds, url, ...fields } = dto;
    const video = await this.prisma.$transaction(async (tx) => {
      if (batchIds) {
        await tx.videoBatch.deleteMany({ where: { videoId: id } });
        await tx.videoBatch.createMany({ data: [...new Set(batchIds)].map((batchId) => ({ videoId: id, batchId })) });
      }
      return tx.video.update({ where: { id }, data: { ...fields, ...(url && { externalUrl: url }) }, select: SELECT });
    });
    await this.log(user, 'video.update', id);
    return video;
  }

  async remove(user: AuthUser, id: string) {
    await this.manageable(user, id);
    await this.prisma.video.delete({ where: { id } });
    await this.log(user, 'video.delete', id);
    return { id, deleted: true };
  }

  private async manageable(user: AuthUser, id: string) {
    const v = await this.prisma.video.findFirst({ where: { id, ...this.scope(user) }, select: { uploadedById: true } });
    if (!v) throw new NotFoundException('Video not found');
    if (user.role === Role.FACULTY && v.uploadedById !== user.id) {
      throw new ForbiddenException('You can only change videos you added');
    }
  }

  private async assertBatches(batchIds?: string[]) {
    if (!batchIds?.length) return;
    const unique = [...new Set(batchIds)];
    if ((await this.prisma.batch.count({ where: { id: { in: unique } } })) !== unique.length) {
      throw new BadRequestException('Unknown batch in batchIds');
    }
  }

  private log(user: AuthUser, action: string, entityId: string) {
    return this.activity.log({ actorId: user.id, action, entity: 'video', entityId });
  }
}

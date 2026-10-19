import { createWriteStream } from 'node:fs';
import { readFile, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { EnrollmentStatus, Role, VideoStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { VideoStoreService } from '../storage/video-store.service.js';
import type { CreateVideoDto, ListVideosQueryDto, StartVideoUploadDto, UpdateVideoDto } from './dto/video.dto.js';
import { mp4Info } from './mp4.js';

/** One upload request; well under Nginx's 160 MB body limit. */
export const UPLOAD_CHUNK_BYTES = 32 * 1024 * 1024;

const SELECT = {
  id: true,
  title: true,
  status: true,
  description: true,
  externalUrl: true,
  sourceKey: true,
  durationSec: true,
  isDemo: true,
  createdAt: true,
  subject: { select: { id: true, name: true } },
  batches: { select: { batch: { select: { id: true, name: true } } } },
} satisfies Prisma.VideoSelect;

type VideoRow = Prisma.VideoGetPayload<{ select: typeof SELECT }>;

/** The storage key stays on the server: clients get `source` and ask `play` for a short-lived link. */
function present({ sourceKey, ...v }: VideoRow) {
  return { ...v, source: sourceKey ? ('file' as const) : ('link' as const) };
}

/**
 * Recorded lectures: a link (YouTube unlisted / Drive) or our own mp4 (Zoom recordings imported by
 * the zoom module, played in the app where screen recording is blocked). Free demo videos are open
 * to every student; others only to their batches. Encrypted HLS comes later (doc 11).
 */
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly store: VideoStoreService,
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
    return { items: items.map(present), page: q.page, limit: q.limit, total };
  }

  /** What the player opens: our file (signed link, hours long so seeking keeps working) or the external link. */
  async play(user: AuthUser, id: string) {
    const v = await this.prisma.video.findFirst({
      where: { id, ...this.scope(user) },
      select: { title: true, externalUrl: true, sourceKey: true, sourceStore: true, durationSec: true },
    });
    if (!v) throw new NotFoundException('Video not found');
    if (v.sourceKey) {
      const url = await this.store.playUrl(v.sourceStore, v.sourceKey, `${v.title.replace(/[^\w\- ]+/g, '_').slice(0, 80)}.mp4`);
      return { source: 'file' as const, url, title: v.title, durationSec: v.durationSec };
    }
    if (!v.externalUrl) throw new NotFoundException('This video has no file or link yet');
    return { source: 'link' as const, url: v.externalUrl, title: v.title, durationSec: v.durationSec };
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
    return present(video);
  }

  /**
   * Our own mp4, sent in chunks (Nginx caps one request at 160 MB). The row stays UPLOADING (hidden from
   * students) until every byte arrived; a chunk sent at the wrong offset is refused with the right one,
   * so a dropped connection resumes instead of starting over.
   */
  async startUpload(user: AuthUser, dto: StartVideoUploadDto) {
    await this.assertBatches(dto.batchIds);
    const video = await this.prisma.video.create({
      data: {
        title: dto.title,
        description: dto.description,
        subjectId: dto.subjectId,
        isDemo: dto.isDemo ?? false,
        status: VideoStatus.UPLOADING,
        uploadedById: user.id,
        batches: { create: [...new Set(dto.batchIds ?? [])].map((batchId) => ({ batchId })) },
      },
      select: SELECT,
    });
    await writeFile(this.store.uploadPath(video.id, 'json'), JSON.stringify({ size: dto.size }));
    await writeFile(this.store.uploadPath(video.id, 'part'), Buffer.alloc(0));
    return { ...present(video), chunkBytes: UPLOAD_CHUNK_BYTES, received: 0, size: dto.size };
  }

  async appendChunk(user: AuthUser, id: string, offset: number, body: Readable) {
    const { size, part } = await this.pendingUpload(user, id);
    const received = (await stat(part)).size;
    if (offset !== received) {
      body.resume(); // drain what was sent; the client resends from `received`
      throw new ConflictException({ code: 'WRONG_OFFSET', message: `Send the file from byte ${received}`, received });
    }
    let bytes = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _enc, done) {
        bytes += chunk.length;
        if (bytes > UPLOAD_CHUNK_BYTES || received + bytes > size) return done(new BadRequestException('Chunk too big'));
        done(null, chunk);
      },
    });
    try {
      await pipeline(body, limit, createWriteStream(part, { flags: 'a' }));
    } catch (err) {
      await truncate(part, received); // keep the file at a clean chunk boundary
      throw err instanceof BadRequestException ? err : new BadRequestException('The upload was interrupted. Send this chunk again.');
    }
    return { id, received: received + bytes, size };
  }

  async completeUpload(user: AuthUser, id: string) {
    const { size, part, meta } = await this.pendingUpload(user, id);
    const received = (await stat(part)).size;
    if (received !== size) throw new BadRequestException(`Only ${received} of ${size} bytes arrived`);
    const info = await mp4Info(part);
    if (!info.isMp4) {
      await rm(part, { force: true });
      await rm(meta, { force: true });
      await this.prisma.video.update({ where: { id }, data: { status: VideoStatus.FAILED } });
      throw new BadRequestException('This file is not an mp4 video');
    }
    const saved = await this.store.save(part);
    await rm(meta, { force: true });
    const video = await this.prisma.video.update({
      where: { id },
      data: { sourceKey: saved.key, sourceStore: saved.store, durationSec: info.durationSec, status: VideoStatus.READY },
      select: SELECT,
    });
    await this.log(user, 'video.upload', id);
    return present(video);
  }

  private async pendingUpload(user: AuthUser, id: string) {
    await this.manageable(user, id);
    const v = await this.prisma.video.findUnique({ where: { id }, select: { status: true } });
    if (v?.status !== VideoStatus.UPLOADING) throw new ConflictException('This video is not waiting for an upload');
    const meta = this.store.uploadPath(id, 'json');
    const part = this.store.uploadPath(id, 'part');
    const { size } = JSON.parse(await readFile(meta, 'utf8').catch(() => '{}')) as { size?: number };
    if (!size) throw new ConflictException('This upload has expired. Start it again.');
    return { size, part, meta };
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
    return present(video);
  }

  async remove(user: AuthUser, id: string) {
    await this.manageable(user, id);
    const v = await this.prisma.video.delete({ where: { id }, select: { sourceKey: true, sourceStore: true } });
    if (v.sourceKey) {
      await this.store.remove(v.sourceStore, v.sourceKey).catch((err) => this.logger.warn(`video file not removed: ${(err as Error).message}`));
    }
    // An upload that never finished leaves its chunks in tmp.
    await rm(this.store.uploadPath(id, 'part'), { force: true });
    await rm(this.store.uploadPath(id, 'json'), { force: true });
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

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ContentStatus, EnrollmentStatus, Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { StorageService } from '../storage/storage.service.js';
import type {
  CreateMaterialDto,
  ListMaterialsQueryDto,
  UpdateMaterialDto,
} from './dto/material.dto.js';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** The bits of a multer file we use (no @types/multer in this project). */
export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

const PDF_MAGIC = Buffer.from('%PDF-');

/** Hide storage keys from API responses: clients only ever get signed URLs. */
const PUBLIC_SELECT = {
  id: true,
  title: true,
  description: true,
  subjectId: true,
  topicId: true,
  fileName: true,
  fileType: true,
  size: true,
  allowDownload: true,
  isDemo: true,
  version: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true } },
  topic: { select: { id: true, name: true } },
  batches: { select: { batch: { select: { id: true, name: true } } } },
} satisfies Prisma.MaterialSelect;

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  /** Students: published + one of their active batches. Faculty: own uploads or their batches. Admin: all. */
  private scope(user: AuthUser): Prisma.MaterialWhereInput {
    if (user.role === Role.STUDENT) {
      // Free demo material is open to every student; the rest only to their own batches.
      // A demo (not yet approved) student gets the demo material only.
      const ownBatches: Prisma.MaterialWhereInput = {
        batches: {
          some: {
            batch: {
              students: {
                some: { status: EnrollmentStatus.ACTIVE, student: { userId: user.id } },
              },
            },
          },
        },
      };
      return {
        status: ContentStatus.PUBLISHED,
        OR: user.demo ? [{ isDemo: true }] : [{ isDemo: true }, ownBatches],
      };
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

  async list(user: AuthUser, q: ListMaterialsQueryDto): Promise<Paginated<unknown>> {
    const where: Prisma.MaterialWhereInput = {
      AND: [
        this.scope(user),
        {
          ...(q.subjectId && { subjectId: q.subjectId }),
          ...(q.topicId && { topicId: q.topicId }),
          ...(q.batchId && { batches: { some: { batchId: q.batchId } } }),
          ...(user.role !== Role.STUDENT && q.status && { status: q.status }),
          ...(user.role !== Role.STUDENT && !q.status && { status: { not: ContentStatus.ARCHIVED } }),
          ...(q.search && {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
            ],
          }),
        },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: q.skip,
        take: q.limit,
        select: PUBLIC_SELECT,
      }),
      this.prisma.material.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async get(user: AuthUser, id: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, ...this.scope(user) },
      select: { ...PUBLIC_SELECT, versions: { orderBy: { version: 'desc' }, select: { version: true, size: true, createdAt: true } } },
    });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async create(user: AuthUser, file: UploadedFile | undefined, dto: CreateMaterialDto) {
    const checked = this.checkFile(file);
    await this.assertRefs(dto.subjectId, dto.topicId, dto.batchIds);
    const key = await this.storage.put(checked.buffer, 'pdf');
    try {
      const material = await this.prisma.material.create({
        data: {
          title: dto.title,
          description: dto.description,
          subjectId: dto.subjectId,
          topicId: dto.topicId,
          allowDownload: dto.allowDownload ?? false,
          isDemo: dto.isDemo ?? false,
          status: dto.status ?? ContentStatus.PUBLISHED,
          fileKey: key,
          fileName: checked.originalname,
          fileType: 'application/pdf',
          size: checked.size,
          uploadedById: user.id,
          versions: { create: { version: 1, fileKey: key, size: checked.size } },
          batches: { create: (dto.batchIds ?? []).map((batchId) => ({ batchId })) },
        },
        select: PUBLIC_SELECT,
      });
      await this.log(user, 'material.create', material.id);
      return material;
    } catch (err) {
      await this.storage.remove(key); // do not orphan the file if the row failed
      throw err;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateMaterialDto) {
    await this.assertCanManage(user, id);
    await this.assertRefs(dto.subjectId, dto.topicId, dto.batchIds);
    const { batchIds, ...fields } = dto;
    const material = await this.prisma.$transaction(async (tx) => {
      if (batchIds) {
        await tx.materialBatch.deleteMany({ where: { materialId: id } });
        await tx.materialBatch.createMany({
          data: [...new Set(batchIds)].map((batchId) => ({ materialId: id, batchId })),
        });
      }
      return tx.material.update({ where: { id }, data: fields, select: PUBLIC_SELECT });
    });
    await this.log(user, 'material.update', id);
    return material;
  }

  /** New version of the same material. Students see the new file immediately; the old one is kept in history. */
  async replace(user: AuthUser, id: string, file: UploadedFile | undefined) {
    const current = await this.assertCanManage(user, id);
    const checked = this.checkFile(file);
    const key = await this.storage.put(checked.buffer, 'pdf');
    const version = current.version + 1;
    try {
      const material = await this.prisma.$transaction(async (tx) => {
        await tx.materialVersion.create({
          data: { materialId: id, version, fileKey: key, size: checked.size },
        });
        return tx.material.update({
          where: { id },
          data: { fileKey: key, fileName: checked.originalname, size: checked.size, version },
          select: PUBLIC_SELECT,
        });
      });
      await this.log(user, 'material.replace', id);
      return material;
    } catch (err) {
      await this.storage.remove(key);
      throw err;
    }
  }

  /** Never hard-deleted (views and versions reference it): archive hides it from students. */
  async archive(user: AuthUser, id: string) {
    await this.assertCanManage(user, id);
    const material = await this.prisma.material.update({
      where: { id },
      data: { status: ContentStatus.ARCHIVED },
      select: PUBLIC_SELECT,
    });
    await this.log(user, 'material.archive', id);
    return material;
  }

  /** Short-lived link for the in-app viewer. Also records the view for analytics. */
  async viewUrl(user: AuthUser, id: string) {
    const m = await this.accessible(user, id);
    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findUnique({ where: { userId: user.id } });
      if (student) {
        await this.prisma.materialView.create({ data: { materialId: id, studentId: student.id } });
      }
    }
    return { url: this.storage.signedUrl(m.fileKey, m.fileName, 'inline'), expiresInSeconds: 180 };
  }

  async downloadUrl(user: AuthUser, id: string) {
    const m = await this.accessible(user, id);
    if (user.role === Role.STUDENT && !m.allowDownload) {
      throw new ForbiddenException('Download is not allowed for this material');
    }
    await this.log(user, 'material.download', id);
    return { url: this.storage.signedUrl(m.fileKey, m.fileName, 'attachment'), expiresInSeconds: 180 };
  }

  /** Per-material engagement for staff: who opened it and how often. */
  async views(user: AuthUser, id: string) {
    await this.assertCanManage(user, id);
    const rows = await this.prisma.materialView.groupBy({
      by: ['studentId'],
      where: { materialId: id },
      _count: { _all: true },
      _max: { viewedAt: true },
    });
    const students = await this.prisma.student.findMany({
      where: { id: { in: rows.map((r) => r.studentId) } },
      select: { id: true, user: { select: { name: true, phone: true } } },
    });
    const byId = new Map(students.map((s) => [s.id, s.user]));
    return {
      totalViews: rows.reduce((n, r) => n + r._count._all, 0),
      viewers: rows
        .map((r) => ({
          studentId: r.studentId,
          name: byId.get(r.studentId)?.name,
          phone: byId.get(r.studentId)?.phone,
          views: r._count._all,
          lastViewedAt: r._max.viewedAt,
        }))
        .sort((a, b) => b.views - a.views),
    };
  }

  private async accessible(user: AuthUser, id: string) {
    const m = await this.prisma.material.findFirst({ where: { id, ...this.scope(user) } });
    if (!m) throw new NotFoundException('Material not found');
    return m;
  }

  private async assertCanManage(user: AuthUser, id: string) {
    const m = await this.prisma.material.findFirst({ where: { id, ...this.scope(user) } });
    if (!m) throw new NotFoundException('Material not found');
    // Faculty may see materials of their batches but only edit their own uploads.
    if (user.role === Role.FACULTY && m.uploadedById !== user.id) {
      throw new ForbiddenException('You can only change materials you uploaded');
    }
    return m;
  }

  /** Extension and Content-Type are client-controlled, so check the file's own signature. */
  private checkFile(file: UploadedFile | undefined): UploadedFile {
    if (!file?.buffer?.length) throw new BadRequestException('Attach a PDF in the "file" field');
    if (file.size > MAX_UPLOAD_BYTES) throw new PayloadTooLargeException('File is larger than 25 MB');
    if (!file.buffer.subarray(0, 5).equals(PDF_MAGIC)) {
      throw new UnsupportedMediaTypeException('Only PDF files are supported');
    }
    return {
      ...file,
      originalname: file.originalname.replace(/[\\/]/g, '_').slice(0, 150) || 'material.pdf',
    };
  }

  private async assertRefs(subjectId?: string, topicId?: string, batchIds?: string[]) {
    if (topicId) {
      const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
      if (!topic) throw new BadRequestException('Unknown topicId');
      if (subjectId && topic.subjectId !== subjectId) {
        throw new BadRequestException('Topic does not belong to the subject');
      }
    }
    if (subjectId && !(await this.prisma.subject.findUnique({ where: { id: subjectId } }))) {
      throw new BadRequestException('Unknown subjectId');
    }
    if (batchIds?.length) {
      const unique = [...new Set(batchIds)];
      const found = await this.prisma.batch.count({ where: { id: { in: unique } } });
      if (found !== unique.length) throw new BadRequestException('Unknown batch in batchIds');
    }
  }

  private log(user: AuthUser, action: string, entityId: string) {
    return this.activity.log({ actorId: user.id, action, entity: 'material', entityId });
  }
}

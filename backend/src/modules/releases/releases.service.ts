import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { StorageService } from '../storage/storage.service.js';

export const MAX_APK_BYTES = 150 * 1024 * 1024;

/** An APK is a zip file: it always starts with "PK\x03\x04". */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export interface UploadedApk {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** Never expose the storage key: clients only get signed links. */
const SELECT = {
  id: true,
  version: true,
  fileName: true,
  size: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.AppReleaseSelect;

@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  list() {
    return this.prisma.appRelease.findMany({ orderBy: { createdAt: 'desc' }, select: SELECT });
  }

  async create(user: AuthUser, file: UploadedApk | undefined, version: string, notes?: string) {
    if (!file?.buffer?.length) throw new BadRequestException('Attach the APK in the "file" field');
    if (file.size > MAX_APK_BYTES) throw new PayloadTooLargeException('APK is larger than 150 MB');
    if (!/\.apk$/i.test(file.originalname) || !file.buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      throw new UnsupportedMediaTypeException('Only .apk files are supported');
    }

    const key = await this.storage.put(file.buffer, 'apk');
    try {
      const release = await this.prisma.appRelease.create({
        data: {
          version,
          fileKey: key,
          // Clients download it as "DHI-<version>.apk", whatever the build called it.
          fileName: `DHI-${version}.apk`,
          size: file.size,
          notes,
          uploadedById: user.id,
        },
        select: SELECT,
      });
      await this.activity.log({ actorId: user.id, action: 'release.create', entity: 'app_release', entityId: release.id, meta: { version } });
      return release;
    } catch (err) {
      await this.storage.remove(key); // do not orphan a 50 MB file if the row failed
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Version ${version} already exists. Use a new version number.`);
      }
      throw err;
    }
  }

  async downloadUrl(user: AuthUser, id: string) {
    const r = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Release not found');
    await this.activity.log({ actorId: user.id, action: 'release.download', entity: 'app_release', entityId: id });
    // 5 minutes: enough for a slow connection to start; the download itself is not cut off.
    return { url: this.storage.signedUrl(r.fileKey, r.fileName, 'attachment', 300), fileName: r.fileName, size: r.size };
  }

  async latestDownloadUrl() {
    const r = await this.prisma.appRelease.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!r) throw new NotFoundException('No app build uploaded yet');
    return { url: this.storage.signedUrl(r.fileKey, r.fileName, 'attachment', 300), fileName: r.fileName, size: r.size, version: r.version };
  }

  /** What the app asks at start-up to decide whether to show "update available". */
  async latestInfo() {
    const r = await this.prisma.appRelease.findFirst({ orderBy: { createdAt: 'desc' }, select: SELECT });
    if (!r) throw new NotFoundException('No app build uploaded yet');
    return { version: r.version, notes: r.notes, size: r.size };
  }

  async remove(user: AuthUser, id: string) {
    const r = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Release not found');
    await this.prisma.appRelease.delete({ where: { id } });
    await this.storage.remove(r.fileKey);
    await this.activity.log({ actorId: user.id, action: 'release.delete', entity: 'app_release', entityId: id, meta: { version: r.version } });
    return { ok: true };
  }
}

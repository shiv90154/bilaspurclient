import { createWriteStream } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ClassStatus, ClassType, RecordingImportStatus, Role, VideoStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { classAudience } from '../notifications/class-reminders.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { VideoStoreService } from '../storage/video-store.service.js';
import { ZoomApiService, type ZoomRecording, type ZoomRecordingFile } from './zoom-api.service.js';

/** A recording belongs to a class if Zoom started it this close to the class's time slot. */
const MATCH_SLACK_MS = 3 * 3600_000;
const MAX_ATTEMPTS = 5;
/** A download "in progress" this long is a crashed one (server restart): retry it. */
const STUCK_MS = 4 * 3600_000;

/** Best MP4 view first: screen + speaker is what a student wants to watch. */
const VIEW_ORDER = [
  'shared_screen_with_speaker_view',
  'shared_screen_with_speaker_view(CC)',
  'shared_screen_with_gallery_view',
  'shared_screen',
  'speaker_view',
  'active_speaker',
  'gallery_view',
];

export function pickMp4(files: ZoomRecordingFile[] | undefined): ZoomRecordingFile | undefined {
  const mp4s = (files ?? []).filter((f) => f.file_type === 'MP4' && f.download_url && (!f.status || f.status === 'completed'));
  const rank = (f: ZoomRecordingFile) => {
    const i = VIEW_ORDER.indexOf(f.recording_type ?? '');
    return i < 0 ? VIEW_ORDER.length : i;
  };
  return mp4s.sort((a, b) => rank(a) - rank(b) || (b.file_size ?? 0) - (a.file_size ?? 0))[0];
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

const LIST_SELECT = {
  id: true,
  meetingId: true,
  topic: true,
  startedAt: true,
  durationSec: true,
  status: true,
  attempts: true,
  error: true,
  createdAt: true,
  updatedAt: true,
  class: { select: { id: true, title: true, startAt: true, batch: { select: { id: true, name: true } } } },
  video: { select: { id: true, title: true } },
} satisfies Prisma.RecordingImportSelect;

/**
 * Zoom cloud recording → our video store → a Video for the class's batch, without anyone lifting a
 * finger. Three ways in, all idempotent on the recording uuid: the recording.completed webhook,
 * an hourly sweep of ended classes (catches a missed webhook), and "Fetch recording" by hand.
 * Downloads run one at a time; failures retry with back-off.
 */
@Injectable()
export class RecordingImportService {
  private readonly logger = new Logger(RecordingImportService.name);
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoom: ZoomApiService,
    private readonly store: VideoStoreService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
  ) {}

  // ───────────── ways in ─────────────

  async webhook(rawBody: Buffer | undefined, timestamp?: string, signature?: string) {
    if (!rawBody || !this.zoom.checkWebhook(rawBody, timestamp, signature)) {
      throw new UnauthorizedException('Invalid Zoom signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      download_token?: string;
      payload?: { plainToken?: string; object?: ZoomRecording };
    };
    if (event.event === 'endpoint.url_validation') return this.zoom.urlValidation(event.payload?.plainToken ?? '');
    if (event.event === 'recording.completed' && event.payload?.object?.uuid) {
      const row = await this.enqueue(event.payload.object, event.download_token);
      return { ok: true, importId: row.id };
    }
    return { ok: true, ignored: event.event ?? null };
  }

  /** "Fetch recording" on a class (admin, or the class's teacher). */
  async fetchForClass(user: AuthUser, classId: string) {
    const c = await this.prisma.liveClass.findUnique({
      where: { id: classId },
      select: { id: true, type: true, meetingId: true, startAt: true, endAt: true, faculty: { select: { userId: true } } },
    });
    if (!c) throw new NotFoundException('Class not found');
    if (user.role === Role.FACULTY && c.faculty?.userId !== user.id) throw new ForbiddenException('You can only manage your own classes');
    if (c.type !== ClassType.ZOOM || !c.meetingId) {
      throw new BadRequestException('This class has no Zoom meeting number (its link must look like https://zoom.us/j/123456789)');
    }
    const found = await this.syncFromZoom(c);
    const rows = await this.prisma.recordingImport.findMany({
      where: { id: { in: found.map((f) => f.id) } },
      select: LIST_SELECT,
    });
    return { found: rows.length, items: rows };
  }

  /** Asks Zoom for the recordings of a class's meeting around the class's time and queues them. */
  private async syncFromZoom(c: { meetingId: string | null; startAt: Date; endAt: Date }) {
    const lo = c.startAt.getTime() - MATCH_SLACK_MS;
    const hi = c.endAt.getTime() + MATCH_SLACK_MS;
    const inSlot = (iso?: string) => !!iso && Date.parse(iso) >= lo && Date.parse(iso) <= hi;
    const queued: { id: string }[] = [];

    const instances = (await this.zoom.pastInstances(c.meetingId!)).filter((i) => inSlot(i.start_time));
    for (const i of instances) {
      const rec = await this.zoom.recording(i.uuid);
      if (rec?.recording_files?.length) queued.push(await this.enqueue(rec));
    }
    if (!instances.length) {
      // Some meetings list no instances; the meeting number alone gives its latest recording.
      const rec = await this.zoom.recording(c.meetingId!);
      if (rec?.recording_files?.length && inSlot(rec.start_time)) queued.push(await this.enqueue(rec));
    }
    return queued;
  }

  /** Stores (or refreshes) one recording to import and starts it. Safe to call again for the same uuid. */
  async enqueue(rec: ZoomRecording, downloadToken?: string) {
    const startedAt = rec.start_time ? new Date(rec.start_time) : null;
    const meetingId = String(rec.id);
    const hasMp4 = !!pickMp4(rec.recording_files);
    const data = {
      meetingId,
      topic: rec.topic?.slice(0, 300),
      startedAt,
      durationSec: rec.duration ? rec.duration * 60 : null,
      payload: rec as unknown as Prisma.InputJsonValue,
      ...(downloadToken && { downloadToken }),
    };

    const existing = await this.prisma.recordingImport.findUnique({ where: { recordingUuid: rec.uuid } });
    if (existing && (existing.status === RecordingImportStatus.DONE || existing.status === RecordingImportStatus.DOWNLOADING)) {
      return existing;
    }
    const classId = existing?.classId ?? (await this.matchClass(meetingId, startedAt));
    const status = hasMp4 ? RecordingImportStatus.PENDING : RecordingImportStatus.SKIPPED;
    const error = hasMp4 ? null : 'No MP4 video in this recording (audio or chat only)';
    const row = existing
      ? await this.prisma.recordingImport.update({ where: { id: existing.id }, data: { ...data, classId, status, error, attempts: 0 } })
      : await this.prisma.recordingImport.create({ data: { ...data, recordingUuid: rec.uuid, classId, status, error } });
    if (hasMp4) this.kick(row.id);
    return row;
  }

  // ───────────── admin ─────────────

  status() {
    return this.prisma.recordingImport
      .groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } })
      .then((groups) => ({
        apiConnected: this.zoom.apiEnabled,
        webhookConnected: this.zoom.webhookEnabled,
        trashAfterImport: this.zoom.trashAfterImport,
        videoStore: this.store.current,
        r2Configured: this.store.r2Configured,
        webhookPath: '/api/integrations/zoom/webhook',
        counts: Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
      }));
  }

  async list(q: { page: number; limit: number; skip: number; status?: RecordingImportStatus }): Promise<Paginated<unknown>> {
    const where: Prisma.RecordingImportWhereInput = q.status ? { status: q.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recordingImport.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.limit, select: LIST_SELECT }),
      this.prisma.recordingImport.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async retry(user: AuthUser, id: string) {
    const row = await this.prisma.recordingImport.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Import not found');
    if (row.status === RecordingImportStatus.DONE || row.status === RecordingImportStatus.DOWNLOADING) {
      throw new BadRequestException(`This import is ${row.status.toLowerCase()}`);
    }
    await this.prisma.recordingImport.update({ where: { id }, data: { status: RecordingImportStatus.PENDING, attempts: 0, error: null } });
    await this.activity.log({ actorId: user.id, action: 'recording.retry', entity: 'recording_import', entityId: id });
    this.kick(id);
    return this.prisma.recordingImport.findUnique({ where: { id }, select: LIST_SELECT });
  }

  // ───────────── worker ─────────────

  /** One download at a time: a 1-hour lecture is ~0.5–1 GB and the server has other work. */
  private kick(id: string) {
    this.queue = this.queue.then(() => this.process(id)).catch((err) => this.logger.error(`import ${id} crashed`, err as Error));
  }

  private async process(id: string) {
    // Claim it: only one worker (and only once) may move PENDING/FAILED → DOWNLOADING.
    const claimed = await this.prisma.recordingImport.updateMany({
      where: { id, status: { in: [RecordingImportStatus.PENDING, RecordingImportStatus.FAILED] } },
      data: { status: RecordingImportStatus.DOWNLOADING, attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    const row = (await this.prisma.recordingImport.findUnique({ where: { id } }))!;
    let tmp: string | undefined;
    let saved: { store: string; key: string } | undefined;
    try {
      let rec = row.payload as unknown as ZoomRecording;
      // Download links in an old payload can go stale: on a retry, ask Zoom for fresh ones.
      if (this.zoom.apiEnabled && (row.attempts > 1 || !pickMp4(rec.recording_files))) {
        const fresh = await this.zoom.recording(row.recordingUuid);
        if (fresh) {
          rec = fresh;
          await this.prisma.recordingImport.update({ where: { id }, data: { payload: fresh as unknown as Prisma.InputJsonValue } });
        }
      }
      const file = pickMp4(rec.recording_files);
      if (!file) {
        await this.prisma.recordingImport.update({
          where: { id },
          data: { status: RecordingImportStatus.SKIPPED, error: 'No MP4 video in this recording (audio or chat only)' },
        });
        return;
      }

      tmp = this.store.tmpPath();
      this.logger.log(`Downloading Zoom recording ${row.meetingId} (${Math.round((file.file_size ?? 0) / 1e6)} MB)`);
      await this.download(file.download_url!, row.downloadToken, tmp);
      saved = await this.store.save(tmp);
      tmp = undefined; // moved

      // Re-match: the class may have been created or given its Zoom link after the webhook came.
      const classId = row.classId ?? (await this.matchClass(row.meetingId, row.startedAt));
      const durationSec =
        file.recording_start && file.recording_end
          ? Math.round((Date.parse(file.recording_end) - Date.parse(file.recording_start)) / 1000)
          : row.durationSec;
      const video = await this.createVideo(row.id, classId, saved, durationSec, rec.topic ?? row.topic, row.startedAt);
      saved = undefined; // owned by the video now
      this.logger.log(`Zoom recording ${row.meetingId} imported as video ${video.id}${classId ? '' : ' (no matching class)'}`);

      if (classId) void this.announce(classId, video.id, video.title);
      if (this.zoom.trashAfterImport && this.zoom.apiEnabled) {
        await this.zoom.trashRecording(row.recordingUuid).catch((err) => this.logger.warn(`Zoom trash failed: ${(err as Error).message}`));
      }
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.logger.warn(`Zoom import ${id} failed (attempt ${row.attempts}): ${message}`);
      if (tmp) await rm(tmp, { force: true }).catch(() => undefined);
      if (saved) await this.store.remove(saved.store, saved.key).catch(() => undefined);
      await this.prisma.recordingImport.update({ where: { id }, data: { status: RecordingImportStatus.FAILED, error: message.slice(0, 500) } });
    }
  }

  private async download(url: string, downloadToken: string | null, dest: string) {
    const u = new URL(url);
    const headers: Record<string, string> = {};
    if (this.zoom.apiEnabled) headers.authorization = `Bearer ${await this.zoom.accessToken()}`;
    else if (downloadToken) u.searchParams.set('access_token', downloadToken);
    else throw new Error('Zoom API keys are not set and this recording has no download token');

    const res = await fetch(u, { headers, redirect: 'follow', signal: AbortSignal.timeout(3 * 3600_000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
    if (/json|html|text/.test(type)) throw new Error(`Download failed: Zoom sent ${type} instead of the video (expired link or no access)`);
    await pipeline(Readable.fromWeb(res.body as NodeReadableStream), createWriteStream(dest));

    // Every MP4 starts with an "ftyp" box: catches an error page saved as a video.
    const fh = await open(dest);
    try {
      const head = Buffer.alloc(8);
      await fh.read(head, 0, 8, 0);
      if (head.subarray(4, 8).toString('latin1') !== 'ftyp') throw new Error('Download failed: the file is not an MP4');
    } finally {
      await fh.close();
    }
  }

  /** The class with this Zoom meeting number nearest to when the recording started. */
  private async matchClass(meetingId: string, startedAt: Date | null): Promise<string | null> {
    if (!startedAt) return null;
    const t = startedAt.getTime();
    const rows = await this.prisma.liveClass.findMany({
      where: {
        meetingId,
        type: ClassType.ZOOM,
        status: { not: ClassStatus.CANCELLED },
        startAt: { lte: new Date(t + MATCH_SLACK_MS) },
        endAt: { gte: new Date(t - MATCH_SLACK_MS) },
      },
      select: { id: true, startAt: true },
    });
    rows.sort((a, b) => Math.abs(a.startAt.getTime() - t) - Math.abs(b.startAt.getTime() - t));
    return rows[0]?.id ?? null;
  }

  /**
   * The Video students watch. Matched: the class's batch can see it at once. Unmatched: no batch
   * yet, the admin picks one under Recorded videos (students see nothing until then).
   */
  private async createVideo(
    importId: string,
    classId: string | null,
    saved: { store: string; key: string },
    durationSec: number | null,
    topic: string | null | undefined,
    startedAt: Date | null,
  ) {
    const cls = classId
      ? await this.prisma.liveClass.findUnique({
          where: { id: classId },
          select: { title: true, batchId: true, createdById: true, faculty: { select: { userId: true } } },
        })
      : null;
    const part = classId ? await this.prisma.classRecording.count({ where: { classId } }) : 0;
    const title = `${cls?.title ?? topic ?? 'Zoom recording'} · ${dateFmt.format(startedAt ?? new Date())}${part ? ` (part ${part + 1})` : ''}`;

    return this.prisma.$transaction(async (tx) => {
      const video = await tx.video.create({
        data: {
          title: title.slice(0, 200),
          description: cls ? 'Recording of the live class' : 'Zoom recording that matched no class: choose its batches',
          status: VideoStatus.READY,
          sourceKey: saved.key,
          sourceStore: saved.store,
          durationSec,
          uploadedById: cls?.faculty?.userId ?? cls?.createdById ?? null,
          ...(cls && { batches: { create: [{ batchId: cls.batchId }] } }),
        },
        select: { id: true, title: true },
      });
      if (classId) await tx.classRecording.create({ data: { classId, videoId: video.id, fileKey: saved.key, durationSec } });
      await tx.recordingImport.update({
        where: { id: importId },
        data: { status: RecordingImportStatus.DONE, error: null, classId, videoId: video.id },
      });
      return video;
    });
  }

  private async announce(classId: string, videoId: string, title: string) {
    try {
      await this.notifications.sendToUsers(await classAudience(this.prisma, classId), {
        title: 'Class recording ready',
        body: title,
        data: { type: 'video_ready', videoId },
      });
    } catch (err) {
      this.logger.error('recording push failed', err as Error);
    }
  }

  // ───────────── safety nets ─────────────

  /** Retries failed downloads with back-off, and picks up work lost in a restart. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailed() {
    try {
      const now = Date.now();
      await this.prisma.recordingImport.updateMany({
        where: { status: RecordingImportStatus.DOWNLOADING, updatedAt: { lt: new Date(now - STUCK_MS) } },
        data: { status: RecordingImportStatus.FAILED, error: 'Interrupted (server restart?)' },
      });
      const rows = await this.prisma.recordingImport.findMany({
        where: {
          OR: [
            { status: RecordingImportStatus.PENDING, updatedAt: { lt: new Date(now - 5 * 60_000) } },
            { status: RecordingImportStatus.FAILED, attempts: { lt: MAX_ATTEMPTS } },
          ],
        },
        select: { id: true, status: true, attempts: true, updatedAt: true },
        take: 20,
      });
      for (const r of rows) {
        // FAILED: wait 10, 20, 40, 80 min between attempts.
        const wait = 10 * 60_000 * 2 ** Math.max(0, r.attempts - 1);
        if (r.status === RecordingImportStatus.PENDING || r.updatedAt.getTime() < now - wait) this.kick(r.id);
      }
    } catch (err) {
      this.logger.error('recording retry sweep failed', err as Error);
    }
  }

  /** Missed webhook? Ask Zoom about Zoom classes that ended in the last 2 days and have no recording yet. */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepEndedClasses() {
    if (!this.zoom.apiEnabled) return;
    const now = Date.now();
    try {
      const classes = await this.prisma.liveClass.findMany({
        where: {
          type: ClassType.ZOOM,
          meetingId: { not: null },
          status: { not: ClassStatus.CANCELLED },
          endAt: { gte: new Date(now - 48 * 3600_000), lte: new Date(now - 20 * 60_000) },
          imports: { none: {} },
        },
        select: { meetingId: true, startAt: true, endAt: true },
        orderBy: { endAt: 'desc' },
        take: 20,
      });
      for (const c of classes) await this.syncFromZoom(c).catch((err) => this.logger.warn(`Zoom sweep: ${(err as Error).message}`));
    } catch (err) {
      this.logger.error('Zoom class sweep failed', err as Error);
    }
  }
}

import { statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Env } from '../../config/env.js';
import { Role, UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { MailService } from '../mail/mail.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SettingsService } from '../settings/settings.service.js';

/** Dashboard turns amber at WARN and red at CRITICAL; admins are emailed from WARN up. */
export const DISK_WARN_PCT = 80;
export const DISK_CRITICAL_PCT = 90;

export type DiskLevel = 'ok' | 'warn' | 'critical';

export function diskLevel(usedPct: number): DiskLevel {
  return usedPct >= DISK_CRITICAL_PCT ? 'critical' : usedPct >= DISK_WARN_PCT ? 'warn' : 'ok';
}

const gb = (bytes: number) => (bytes / 1e9).toFixed(1);

/**
 * Health of the things that fail quietly: the disk that holds uploads and recordings (a full disk
 * stops the database too), push notifications and email. Admins see it on the dashboard and get
 * an email once a day while the disk is filling up.
 */
@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly storageDir: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityService,
  ) {
    this.storageDir = resolve(config.get('STORAGE_DIR', { infer: true }));
  }

  async disk() {
    const s = await statfs(this.storageDir);
    const totalBytes = s.blocks * s.bsize;
    const freeBytes = s.bavail * s.bsize; // what we can still write (the root-only reserve excluded)
    const usedPct = totalBytes ? Math.round(((totalBytes - freeBytes) / totalBytes) * 1000) / 10 : 0;
    return { totalBytes, freeBytes, usedPct, level: diskLevel(usedPct) };
  }

  async status() {
    const [disk, devicesWithPush] = await Promise.all([
      this.disk().catch(() => null),
      this.prisma.device.count({
        where: { fcmToken: { not: null }, sessions: { some: { revokedAt: null, expiresAt: { gt: new Date() } } } },
      }),
    ]);
    return {
      disk,
      push: { enabled: this.notifications.enabled, devicesWithPush },
      email: { enabled: this.mail.enabled },
    };
  }

  /** Sends a test push to one user (by phone or email) or to yourself, and reports what happened. */
  async testPush(admin: AuthUser, identifier?: string) {
    const id = identifier?.trim();
    const target = id
      ? await this.prisma.user.findFirst({
          where: { deletedAt: null, OR: [{ phone: id }, { email: id.toLowerCase() }] },
          select: { id: true, name: true },
        })
      : await this.prisma.user.findUnique({ where: { id: admin.id }, select: { id: true, name: true } });
    if (!target) throw new NotFoundException('No user with this phone or email');
    const report = await this.notifications.sendWithReport([target.id], {
      title: 'Test notification',
      body: 'Notifications are working on this phone.',
      data: { type: 'test' },
    });
    await this.activity.log({ actorId: admin.id, action: 'system.test-push', entity: 'user', entityId: target.id, meta: report });
    return { user: target, ...report };
  }

  /** Every morning: warn the admins by email while the disk is 80%+ full. */
  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async diskAlert() {
    try {
      const d = await this.disk();
      if (d.level === 'ok') return;
      this.logger.warn(`Disk ${d.usedPct}% full (${gb(d.freeBytes)} GB free)`);
      if (!this.mail.enabled) return;
      const admins = await this.prisma.user.findMany({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE, deletedAt: null, email: { not: null } },
        select: { email: true, name: true },
      });
      const info = await this.settings.publicInfo();
      for (const a of admins) {
        await this.mail
          .sendBranded(
            a.email!,
            `Server disk ${d.usedPct}% full`,
            {
              preheader: `Only ${gb(d.freeBytes)} GB left on the server.`,
              heading: d.level === 'critical' ? 'The server disk is almost full' : 'The server disk is filling up',
              greeting: `Hello ${a.name.split(' ')[0]},`,
              paragraphs: [
                `The disk that holds notes, recordings and the database is ${d.usedPct}% full. When it is full, uploads, recordings and logins stop working.`,
                'Delete old recorded videos you no longer need, move recordings to Cloudflare R2 (VIDEO_STORE=r2), or ask your developer to add disk space.',
              ],
              rows: [
                { label: 'Used', value: `${d.usedPct}%` },
                { label: 'Free', value: `${gb(d.freeBytes)} GB of ${gb(d.totalBytes)} GB` },
              ],
              footnote: 'You get this email every morning while the disk is more than 80% full.',
            },
            info,
          )
          .catch((err) => this.logger.error(`disk alert mail to ${a.email} failed: ${String(err)}`));
      }
    } catch (err) {
      this.logger.error('disk check failed', err as Error);
    }
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Env } from '../../config/env.js';
import { EnrollmentStatus, OtpPurpose, StudentStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { maskEmail, OtpService } from '../account/otp.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { NOTIFY_PREFS, readNotifyPrefs } from '../notifications/notifications.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { NotificationPrefsDto, UpdateMyProfileDto } from './dto/self.dto.js';

const DAY_MS = 24 * 3600_000;

/**
 * What a signed-in student does with their own account: contact details, email (confirmed by a
 * code), the phones they used, which pushes they get, and the digital ID card.
 */
@Injectable()
export class StudentSelfService {
  private readonly cardSecret: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly activity: ActivityService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<Env, true>,
  ) {
    // Derived key: an ID card code can never be turned into a login token or a file link.
    this.cardSecret = createHmac('sha256', config.get('JWT_ACCESS_SECRET', { infer: true }))
      .update('student-id-card')
      .digest();
  }

  /** The signed-in student's id (404 when the account has no student profile). */
  async studentId(user: AuthUser) {
    const s = await this.prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!s) throw new NotFoundException('Student profile not found');
    return s.id;
  }

  async updateProfile(user: AuthUser, dto: UpdateMyProfileDto) {
    const id = await this.studentId(user);
    const data = Object.fromEntries(
      Object.entries(dto)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, v === '' ? null : v]),
    );
    if (!Object.keys(data).length) return { updated: false };
    await this.prisma.student.update({ where: { id }, data });
    await this.activity.log({
      actorId: user.id,
      action: 'student.self-update',
      entity: 'student',
      entityId: id,
      meta: { fields: Object.keys(data).join(',') },
    });
    return { updated: true };
  }

  // ───────────── email (confirmed by a code sent to the new address) ─────────────

  async emailStart(user: AuthUser, email: string) {
    await this.assertEmailFree(user, email);
    await this.otp.issue(email, OtpPurpose.CHANGE_EMAIL, { userId: user.id });
    return { sent: true, email: maskEmail(email), expiresInSec: 600 };
  }

  async emailVerify(user: AuthUser, email: string, code: string) {
    const payload = (await this.otp.verify(email, OtpPurpose.CHANGE_EMAIL, code)) as { userId?: string } | null;
    // A code is tied to the account that asked for it.
    if (payload?.userId !== user.id) throw new BadRequestException('Ask for a new code from your profile');
    await this.assertEmailFree(user, email);
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    await this.prisma.user.update({ where: { id: user.id }, data: { email, emailVerifiedAt: new Date() } });
    await this.activity.log({
      actorId: user.id,
      action: 'user.email-change',
      entity: 'user',
      entityId: user.id,
      meta: { from: before.email ? maskEmail(before.email) : null, to: maskEmail(email) },
    });
    return { email };
  }

  private async assertEmailFree(user: AuthUser, email: string) {
    const other = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: user.id } },
      select: { id: true },
    });
    if (other) throw new ConflictException('This email is already used by another account');
    const mine = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    if (mine.email?.toLowerCase() === email) throw new BadRequestException('This is already your email');
  }

  // ───────────── devices ─────────────

  /** Phones / browsers this account signed in from, and how many new ones are left this month. */
  async devices(user: AuthUser) {
    const [devices, current] = await Promise.all([
      this.prisma.device.findMany({
        where: { userId: user.id },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true, name: true, platform: true, status: true, firstSeenAt: true, lastSeenAt: true },
      }),
      this.prisma.session.findUnique({ where: { id: user.sessionId }, select: { deviceRefId: true } }),
    ]);
    const since = Date.now() - 30 * DAY_MS;
    const limit = this.config.get('DEVICE_CHANGE_LIMIT_30D', { infer: true });
    const usedThisMonth = devices.filter((d) => d.firstSeenAt.getTime() >= since).length;
    return {
      devices: devices.map((d) => ({ ...d, current: d.id === current?.deviceRefId })),
      limit,
      usedThisMonth,
      remaining: Math.max(0, limit - usedThisMonth),
    };
  }

  // ───────────── notification settings ─────────────

  async notificationPrefs(user: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { notifyPrefs: true } });
    return readNotifyPrefs(u.notifyPrefs);
  }

  async setNotificationPrefs(user: AuthUser, dto: NotificationPrefsDto) {
    const prefs = { ...(await this.notificationPrefs(user)) };
    for (const k of NOTIFY_PREFS) if (typeof dto[k] === 'boolean') prefs[k] = dto[k];
    await this.prisma.user.update({ where: { id: user.id }, data: { notifyPrefs: prefs } });
    return prefs;
  }

  // ───────────── digital ID card ─────────────

  /** Only approved (ACTIVE) students get a card. */
  async idCard(user: AuthUser) {
    const s = await this.prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: {
        id: true,
        admissionNo: true,
        status: true,
        photoKey: true,
        createdAt: true,
        user: { select: { name: true, phone: true } },
        batches: {
          where: { status: EnrollmentStatus.ACTIVE },
          select: { batch: { select: { name: true, endDate: true, course: { select: { name: true } } } } },
        },
      },
    });
    if (!s) throw new NotFoundException('Student profile not found');
    if (s.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException('Your ID card is ready once the institute approves your admission');
    }
    const info = await this.settings.publicInfo();
    return {
      instituteName: info.instituteName,
      contactPhone: info.contactPhone ?? null,
      name: s.user.name,
      phone: s.user.phone,
      admissionNo: s.admissionNo,
      photoUrl: s.photoKey ? this.storage.signedUrl(s.photoKey, 'photo', 'inline', 3600) : null,
      memberSince: s.createdAt,
      courses: s.batches.map((b) => `${b.batch.course.name} - ${b.batch.name}`),
      validTill: latest(s.batches.map((b) => b.batch.endDate)),
      // Opens the website's /verify/<code> page, which tells whether the card is still valid.
      verifyCode: this.cardCode(s.id),
    };
  }

  /** Public check behind the QR: only what the card already shows, never contact details or photo. */
  async verifyCard(code: string) {
    const id = this.readCardCode(code);
    const s = id
      ? await this.prisma.student.findFirst({
          where: { id, deletedAt: null },
          select: {
            admissionNo: true,
            status: true,
            user: { select: { name: true } },
            batches: {
              where: { status: EnrollmentStatus.ACTIVE },
              select: { batch: { select: { name: true, endDate: true, course: { select: { name: true } } } } },
            },
          },
        })
      : null;
    if (!s) throw new NotFoundException('This ID card is not valid');
    const info = await this.settings.publicInfo();
    const validTill = latest(s.batches.map((b) => b.batch.endDate));
    const now = new Date();
    // The course end date counts to the end of that day.
    const expired = validTill !== null && validTill.getTime() + DAY_MS <= now.getTime();
    return {
      instituteName: info.instituteName,
      name: s.user.name,
      admissionNo: s.admissionNo,
      active: s.status === StudentStatus.ACTIVE,
      expired,
      valid: s.status === StudentStatus.ACTIVE && !expired,
      courses: s.batches.map((b) => `${b.batch.course.name} - ${b.batch.name}`),
      validTill,
      checkedAt: now,
    };
  }

  /** "<student id without dashes>.<16 hex of HMAC>": short enough for a clean QR. */
  private cardCode(studentId: string) {
    const raw = studentId.replaceAll('-', '');
    return `${raw}.${this.cardSig(raw)}`;
  }

  private readCardCode(code: string): string | null {
    const m = /^([0-9a-f]{32})\.([0-9a-f]{16})$/.exec(code.toLowerCase());
    if (!m) return null;
    const given = Buffer.from(m[2], 'hex');
    const expected = Buffer.from(this.cardSig(m[1]), 'hex');
    if (!timingSafeEqual(given, expected)) return null;
    const h = m[1];
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  private cardSig(raw: string) {
    return createHmac('sha256', this.cardSecret).update(raw).digest('hex').slice(0, 16);
  }
}

function latest(dates: (Date | null)[]): Date | null {
  const known = dates.filter((d): d is Date => d !== null);
  return known.length ? new Date(Math.max(...known.map((d) => d.getTime()))) : null;
}

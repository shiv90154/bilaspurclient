import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.js';
import {
  ErrorCode,
  badRequest,
  forbidden,
  unauthorized,
  underMaintenance,
} from '../../common/errors.js';
import { hashPassword, verifyPassword } from '../../common/password.util.js';
import type { AccessTokenPayload, AuthUser } from '../../common/types/auth-user.js';
import {
  DeviceStatus,
  OtpPurpose,
  Platform,
  Role,
  SessionRevokeReason,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { maskEmail, OtpService } from '../account/otp.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import {
  buildRefreshToken,
  generateRefreshSecret,
  hashRefreshSecret,
  parseRefreshToken,
  secretMatchesHash,
} from './tokens.util.js';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  studentId: string | null;
  /** Faint name + phone overlay in the student app. The admin switches it on in Settings. */
  watermark: { enabled: boolean; name: string; phone: string };
  /** The student has not yet accepted the current terms + privacy policy: the app asks first. */
  consentRequired: boolean;
  /** Self-registered and not yet approved: only demo notes/tests, no doubts or classes. */
  demo: boolean;
  /** The course a demo student asked to join. */
  requestedCourse: { id: string; name: string } | null;
  /** Staff: login also needs a code emailed to them. */
  twoFactorEnabled: boolean;
}

export interface LoginResult extends TokenPair {
  user: AuthProfile;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly activity: ActivityService,
    private readonly settings: SettingsService,
    private readonly privacy: PrivacyService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    const identifier = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ phone: identifier }, { email: identifier.toLowerCase() }],
      },
      include: { student: { select: { id: true, status: true, requestedCourse: { select: { id: true, name: true } } } } },
    });

    if (!user) {
      await this.burnPasswordCheck(dto.password); // keep timing similar
      throw unauthorized(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid phone/email or password',
      );
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw forbidden(
        ErrorCode.ACCOUNT_LOCKED,
        'Too many failed attempts. Try again later.',
      );
    }

    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      await this.recordFailedLogin(user.id);
      throw unauthorized(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid phone/email or password',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw forbidden(ErrorCode.ACCOUNT_DISABLED, 'Account is disabled');
    }
    if (
      user.role === Role.STUDENT &&
      user.student &&
      user.student.status !== StudentStatus.ACTIVE &&
      user.student.status !== StudentStatus.PENDING
    ) {
      throw forbidden(
        ErrorCode.STUDENT_NOT_ACTIVE,
        'Your account is not active. Please contact the institute.',
      );
    }
    if (user.role === Role.STUDENT) {
      const maintenance = await this.settings.maintenance();
      if (maintenance.on) throw underMaintenance(maintenance.message);
    }
    // The Android app is for students only; staff work in the web panel.
    if (dto.platform === Platform.ANDROID && user.role !== Role.STUDENT) {
      throw forbidden(
        ErrorCode.STAFF_USE_WEB,
        'This app is for students. Admins and teachers use the web panel.',
      );
    }

    // Two-step login (staff who switched it on): the password alone only gets a code emailed.
    if (user.twoFactorEnabled && user.role !== Role.STUDENT && user.email) {
      if (!this.mail.canDeliver) {
        // Never lock the admin out because email was switched off on the server.
        this.logger.warn(`Two-step login skipped for ${user.id}: email is not set up`);
      } else if (!dto.otp) {
        await this.otp.issue(user.email, OtpPurpose.LOGIN_2FA);
        throw new UnauthorizedException({
          statusCode: 401,
          code: ErrorCode.OTP_REQUIRED,
          message: `We emailed a 6-digit code to ${maskEmail(user.email)}. Enter it to finish signing in.`,
          email: maskEmail(user.email),
        });
      } else {
        await this.otp.verify(user.email, OtpPurpose.LOGIN_2FA, dto.otp);
      }
    }

    const isStudent = user.role === Role.STUDENT;
    if (isStudent && !dto.deviceId) {
      throw badRequest(
        ErrorCode.DEVICE_ID_REQUIRED,
        'deviceId is required for student login',
      );
    }

    const now = new Date();
    const secret = generateRefreshSecret();
    const session = await this.prisma.$transaction(async (tx) => {
      let deviceRefId: string | null = null;

      if (dto.deviceId) {
        const platform = dto.platform ?? Platform.WEB;
        const existing = await tx.device.findUnique({
          where: {
            userId_deviceId: { userId: user.id, deviceId: dto.deviceId },
          },
        });

        if (existing) {
          if (existing.status === DeviceStatus.BLOCKED) {
            throw forbidden(
              ErrorCode.DEVICE_BLOCKED,
              'This device is blocked. Contact the institute.',
            );
          }
          await tx.device.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: now,
              platform,
              name: dto.deviceName ?? existing.name,
            },
          });
          deviceRefId = existing.id;
        } else {
          if (isStudent) {
            const since = new Date(now.getTime() - 30 * DAY_MS);
            const recent = await tx.device.count({
              where: { userId: user.id, firstSeenAt: { gte: since } },
            });
            const limit = this.config.get('DEVICE_CHANGE_LIMIT_30D', {
              infer: true,
            });
            // Google's reviewers sign in from many test devices; the admin lifts the limit meanwhile.
            if (recent >= limit && !(await this.settings.get('playReviewMode'))) {
              throw forbidden(
                ErrorCode.DEVICE_LIMIT_REACHED,
                'Device change limit reached. Contact the institute.',
              );
            }
          }
          const created = await tx.device.create({
            data: {
              userId: user.id,
              deviceId: dto.deviceId,
              name: dto.deviceName,
              platform,
            },
          });
          deviceRefId = created.id;
        }
      }

      // One student = one active session. Logging in here ends every other one.
      if (isStudent) {
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now, revokedReason: SessionRevokeReason.REPLACED },
        });
      }

      return tx.session.create({
        data: {
          userId: user.id,
          deviceRefId,
          refreshTokenHash: hashRefreshSecret(secret),
          expiresAt: this.refreshExpiry(now),
          ip: meta.ip,
          userAgent: meta.userAgent?.slice(0, 255),
        },
      });
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null },
    });
    await this.activity.log({
      actorId: user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      ip: meta.ip,
      meta: { deviceId: dto.deviceId ?? null, platform: dto.platform ?? null },
    });

    return {
      ...(await this.issueTokens(user.id, user.role, session.id, secret)),
      user: await this.toProfile(user),
    };
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const parsed = parseRefreshToken(dto.refreshToken);
    if (!parsed) {
      throw unauthorized(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid refresh token',
      );
    }

    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: {
        user: { include: { student: { select: { id: true, status: true } } } },
      },
    });
    if (!session) {
      throw unauthorized(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid refresh token',
      );
    }
    if (session.revokedAt) {
      throw unauthorized(
        session.revokedReason === SessionRevokeReason.REPLACED
          ? ErrorCode.SESSION_REPLACED
          : ErrorCode.SESSION_REVOKED,
        'Session ended',
      );
    }
    const now = new Date();
    if (session.expiresAt.getTime() < now.getTime()) {
      throw unauthorized(ErrorCode.SESSION_EXPIRED, 'Session expired');
    }

    if (!secretMatchesHash(parsed.secret, session.refreshTokenHash)) {
      // An old (already rotated) token was replayed: assume it leaked.
      await this.prisma.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.REFRESH_REUSE },
      });
      throw unauthorized(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid refresh token',
      );
    }

    const { user } = session;
    if (user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw forbidden(ErrorCode.ACCOUNT_DISABLED, 'Account is disabled');
    }
    if (
      user.role === Role.STUDENT &&
      user.student &&
      user.student.status !== StudentStatus.ACTIVE &&
      user.student.status !== StudentStatus.PENDING
    ) {
      throw forbidden(
        ErrorCode.STUDENT_NOT_ACTIVE,
        'Your account is not active. Please contact the institute.',
      );
    }

    // Rotate. The WHERE on the old hash makes concurrent refreshes safe:
    // only one of them can win.
    const newSecret = generateRefreshSecret();
    const rotated = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: hashRefreshSecret(newSecret),
        lastUsedAt: now,
        expiresAt: this.refreshExpiry(now),
      },
    });
    if (rotated.count === 0) {
      throw unauthorized(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid refresh token',
      );
    }

    return this.issueTokens(user.id, user.role, session.id, newSecret);
  }

  async logout(user: AuthUser): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: user.sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: SessionRevokeReason.LOGOUT },
    });
  }

  async me(user: AuthUser): Promise<AuthProfile> {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { student: { select: { id: true, status: true, requestedCourse: { select: { id: true, name: true } } } } },
    });
    return this.toProfile(record);
  }

  /**
   * The signed-in user changes their own password. Every other session ends (a stolen
   * session stops working); the one making the change stays signed in.
   */
  async changePassword(user: AuthUser, dto: ChangePasswordDto, meta: RequestMeta): Promise<void> {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    // 400, not 401: clients treat a 401 as "session gone" and would log the user out.
    if (!(await verifyPassword(record.passwordHash, dto.currentPassword))) {
      throw badRequest(ErrorCode.WRONG_PASSWORD, 'Current password is wrong');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw badRequest(ErrorCode.PASSWORD_UNCHANGED, 'Choose a password different from the current one');
    }
    const passwordHash = await hashPassword(dto.newPassword);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: user.sessionId } },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.PASSWORD_CHANGED },
      }),
    ]);
    await this.activity.log({
      actorId: user.id,
      action: 'auth.change-password',
      entity: 'user',
      entityId: user.id,
      ip: meta.ip,
    });
  }

  // ───────────── two-step login (staff) ─────────────

  /** Step 1 of switching it on: checks the password and emails a code (proves the email works). */
  async twoFactorStart(user: AuthUser, password: string) {
    const record = await this.staffForTwoFactor(user, password);
    if (!this.mail.canDeliver) throw badRequest(ErrorCode.WRONG_PASSWORD, 'Email is not set up on the server, so two-step login cannot be used yet');
    await this.otp.issue(record.email!, OtpPurpose.ENABLE_2FA);
    return { email: maskEmail(record.email!) };
  }

  /** Step 2: the code from that email turns it on. */
  async twoFactorEnable(user: AuthUser, code: string, meta: RequestMeta) {
    const record = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    if (!record.email) throw badRequest(ErrorCode.WRONG_PASSWORD, 'Add an email to your account first');
    await this.otp.verify(record.email, OtpPurpose.ENABLE_2FA, code);
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    await this.activity.log({ actorId: user.id, action: 'auth.2fa-on', entity: 'user', entityId: user.id, ip: meta.ip });
    return { twoFactorEnabled: true };
  }

  async twoFactorDisable(user: AuthUser, password: string, meta: RequestMeta) {
    await this.staffForTwoFactor(user, password);
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false } });
    await this.activity.log({ actorId: user.id, action: 'auth.2fa-off', entity: 'user', entityId: user.id, ip: meta.ip });
    return { twoFactorEnabled: false };
  }

  private async staffForTwoFactor(user: AuthUser, password: string) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true, email: true, role: true },
    });
    if (record.role === Role.STUDENT) throw forbidden(ErrorCode.FORBIDDEN_ROLE, 'Two-step login is for admins and teachers');
    // 400, not 401: clients treat a 401 as "session gone".
    if (!(await verifyPassword(record.passwordHash, password))) throw badRequest(ErrorCode.WRONG_PASSWORD, 'Password is wrong');
    if (!record.email) throw badRequest(ErrorCode.WRONG_PASSWORD, 'Add an email to your account first');
    return record;
  }

  // ───────────── helpers ─────────────

  private async issueTokens(
    userId: string,
    role: Role,
    sessionId: string,
    refreshSecret: string,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: userId, role, sid: sessionId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: buildRefreshToken(sessionId, refreshSecret),
      expiresIn: this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
    };
  }

  private refreshExpiry(from: Date): Date {
    const days = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    return new Date(from.getTime() + days * DAY_MS);
  }

  private async toProfile(user: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: Role;
    twoFactorEnabled: boolean;
    student?: { id: string; status: StudentStatus; requestedCourse: { id: string; name: string } | null } | null;
  }): Promise<AuthProfile> {
    const demo = user.role === Role.STUDENT && user.student?.status === StudentStatus.PENDING;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      studentId: user.student?.id ?? null,
      watermark: {
        enabled: await this.settings.get('watermarkEnabled'),
        name: user.name,
        phone: user.phone,
      },
      consentRequired: await this.privacy.consentRequired(user.id, user.role),
      demo,
      requestedCourse: demo ? (user.student?.requestedCourse ?? null) : null,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }

  private async recordFailedLogin(userId: string): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
      select: { failedLoginCount: true },
    });
    const max = this.config.get('LOGIN_MAX_FAILURES', { infer: true });
    if (updated.failedLoginCount >= max) {
      const minutes = this.config.get('LOGIN_LOCK_MINUTES', { infer: true });
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginCount: 0,
          lockedUntil: new Date(Date.now() + minutes * 60_000),
        },
      });
    }
  }

  /** Spend roughly the same time as a real check when the user is unknown. */
  private async burnPasswordCheck(password: string): Promise<void> {
    this.dummyHash ??= hashPassword('not-a-real-password');
    await verifyPassword(await this.dummyHash, password).catch(() => false);
  }
}

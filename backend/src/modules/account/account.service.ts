import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { underMaintenance } from '../../common/errors.js';
import { hashPassword } from '../../common/password.util.js';
import { Prisma } from '../../generated/prisma/client.js';
import { OtpPurpose, Role, SessionRevokeReason, StudentStatus, UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { MailService } from '../mail/mail.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type {
  ForgotPasswordDto,
  RegisterStartDto,
  RegisterVerifyDto,
  ResetPasswordWithOtpDto,
} from './dto/account.dto.js';
import { escapeHtml, maskEmail, OtpService } from './otp.service.js';

interface PendingSignup {
  name: string;
  phone: string;
  passwordHash: string;
  courseId: string;
  via: 'APP' | 'WEB';
}

/**
 * Self-registration (email OTP) and forgot password (email OTP).
 * A self-registered student starts as PENDING: they can log in and use the demo content,
 * and get full access when the admin approves them into a batch.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityService,
  ) {}

  /** Courses a visitor can choose when signing up. */
  publicCourses() {
    return this.prisma.course.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
  }

  /** Step 1: check the form, keep it with a code, email the code. Nothing is created yet. */
  async registerStart(dto: RegisterStartDto) {
    const maintenance = await this.settings.maintenance();
    if (maintenance.on) throw underMaintenance(maintenance.message);
    const course = await this.prisma.course.findFirst({ where: { id: dto.courseId, active: true }, select: { id: true } });
    if (!course) throw new BadRequestException('Choose a course from the list');
    await this.assertFree(dto.phone, dto.email);

    const payload: PendingSignup = {
      name: dto.name,
      phone: dto.phone,
      passwordHash: await hashPassword(dto.password),
      courseId: dto.courseId,
      via: dto.via ?? 'APP',
    };
    await this.otp.issue(dto.email, OtpPurpose.REGISTER, { ...payload });
    return { sent: true, email: maskEmail(dto.email), expiresInSec: 600 };
  }

  /** Sends a fresh code for a sign-up that was started but not finished. */
  async registerResend(email: string) {
    const last = await this.prisma.emailOtp.findFirst({
      where: { email, purpose: OtpPurpose.REGISTER },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    if (!last?.payload) throw new BadRequestException('Start the sign-up again');
    const p = last.payload as unknown as PendingSignup;
    await this.assertFree(p.phone, email);
    await this.otp.issue(email, OtpPurpose.REGISTER, last.payload);
    return { sent: true, email: maskEmail(email), expiresInSec: 600 };
  }

  /** Step 2: the right code creates the account (PENDING = demo until approved). */
  async registerVerify(dto: RegisterVerifyDto) {
    const payload = (await this.otp.verify(dto.email, OtpPurpose.REGISTER, dto.code)) as unknown as PendingSignup | null;
    if (!payload) throw new BadRequestException('Start the sign-up again');
    await this.assertFree(payload.phone, dto.email);

    let student;
    try {
      student = await this.prisma.student.create({
        data: {
          status: StudentStatus.PENDING,
          registeredVia: payload.via,
          requestedCourse: { connect: { id: payload.courseId } },
          user: {
            create: {
              name: payload.name,
              phone: payload.phone,
              email: dto.email,
              emailVerifiedAt: new Date(),
              passwordHash: payload.passwordHash,
              role: Role.STUDENT,
            },
          },
        },
        select: { id: true, userId: true, requestedCourse: { select: { name: true } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This phone number or email is already registered. Log in instead.');
      }
      throw err;
    }
    await this.activity.log({
      actorId: student.userId,
      action: 'student.register',
      entity: 'student',
      entityId: student.id,
      meta: { via: payload.via, courseId: payload.courseId },
    });
    void this.tellInstitute(payload.name, payload.phone, student.requestedCourse?.name ?? '');
    return { registered: true, phone: payload.phone };
  }

  /**
   * Forgot password, step 1. Always answers the same, so nobody can find out who has an
   * account. The code goes to the email on the account (never to an address typed here).
   */
  async forgot(dto: ForgotPasswordDto) {
    const user = await this.findByIdentifier(dto.identifier);
    if (user?.email) await this.otp.issue(user.email.toLowerCase(), OtpPurpose.RESET_PASSWORD, undefined, true);
    return {
      sent: true,
      message: 'If this account has an email address, a 6 digit code was sent to it. No email on the account? Ask the institute to reset your password.',
    };
  }

  /** Forgot password, step 2: code + new password. Logs out every device. */
  async reset(dto: ResetPasswordWithOtpDto) {
    const user = await this.findByIdentifier(dto.identifier);
    if (!user?.email) throw new BadRequestException({ statusCode: 400, code: 'OTP_INVALID', message: 'Wrong or expired code' });
    await this.otp.verify(user.email.toLowerCase(), OtpPurpose.RESET_PASSWORD, dto.code);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(dto.newPassword), failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.PASSWORD_CHANGED },
      }),
    ]);
    await this.activity.log({ actorId: user.id, action: 'auth.reset-password', entity: 'user', entityId: user.id });
    void this.mail
      .send({
        to: user.email,
        subject: 'Your password was changed',
        text: `Hello ${user.name},\n\nThe password of your account was just changed and every device was logged out.\nIf this was not you, contact the institute straight away.`,
      })
      .catch(() => undefined);
    return { reset: true };
  }

  private findByIdentifier(identifier: string) {
    const id = identifier.trim();
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        OR: [{ phone: id }, { email: { equals: id, mode: 'insensitive' } }],
      },
      select: { id: true, name: true, email: true },
    });
  }

  private async assertFree(phone: string, email: string) {
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, { email: { equals: email, mode: 'insensitive' } }] },
      select: { phone: true },
    });
    if (taken) {
      throw new ConflictException(
        taken.phone === phone
          ? 'This mobile number is already registered. Log in, or use "Forgot password".'
          : 'This email is already registered. Log in, or use "Forgot password".',
      );
    }
  }

  /** Best effort: an email to the institute's contact address about a new sign-up. */
  private async tellInstitute(name: string, phone: string, course: string) {
    try {
      const { contactEmail, instituteName } = await this.settings.publicInfo();
      if (!contactEmail || !this.mail.enabled) return;
      await this.mail.send({
        to: contactEmail,
        subject: `New registration: ${name}`,
        text: `${name} (${phone}) registered for ${course || 'a course'}.\nOpen the admin panel → Registrations to approve them.`,
        html: `<p><b>${escapeHtml(name)}</b> (${escapeHtml(phone)}) registered for <b>${escapeHtml(course || 'a course')}</b> at ${escapeHtml(instituteName)}.</p><p>Open the admin panel → Registrations to approve them.</p>`,
      });
    } catch (err) {
      this.logger.warn(`Could not email the institute about a registration: ${String(err)}`);
    }
  }
}

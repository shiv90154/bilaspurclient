import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OtpPurpose } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { SettingsService } from '../settings/settings.service.js';

const TTL_MS = 10 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_PER_HOUR = 5;
const MAX_TRIES = 5;

const SUBJECT: Record<OtpPurpose, string> = {
  REGISTER: 'Your sign-up code',
  RESET_PASSWORD: 'Your password reset code',
};
const LINE: Record<OtpPurpose, string> = {
  REGISTER: 'Use this code to confirm your email and finish creating your account.',
  RESET_PASSWORD: 'Use this code to set a new password. If you did not ask for this, ignore this email; your password stays the same.',
};

/** 6-digit email codes: 10 minutes, 5 tries, one resend a minute, 5 an hour per email. */
@Injectable()
export class OtpService {
  private readonly secret: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    config: ConfigService<Env, true>,
  ) {
    // Derived key: a database leak alone does not reveal codes.
    this.secret = createHmac('sha256', config.get('JWT_ACCESS_SECRET', { infer: true })).update('email-otp').digest();
  }

  private hash(email: string, purpose: OtpPurpose, code: string) {
    return createHmac('sha256', this.secret).update(`${purpose}|${email}|${code}`).digest('hex');
  }

  /** Throws 429 when asked again too soon. `quiet` swallows that instead (forgot password). */
  async issue(email: string, purpose: OtpPurpose, payload?: Prisma.InputJsonValue, quiet = false): Promise<boolean> {
    const now = Date.now();
    const recent = await this.prisma.emailOtp.findMany({
      where: { email, purpose, createdAt: { gte: new Date(now - 3600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const tooSoon = recent[0] && now - recent[0].createdAt.getTime() < RESEND_AFTER_MS;
    if (tooSoon || recent.length >= MAX_PER_HOUR) {
      if (quiet) return false;
      throw new HttpException(
        {
          statusCode: 429,
          code: 'OTP_TOO_SOON',
          message: tooSoon ? 'A code was just sent. Wait a minute before asking again.' : 'Too many codes asked for. Try again in an hour.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const [, row] = await this.prisma.$transaction([
      // Only the newest code works.
      this.prisma.emailOtp.updateMany({ where: { email, purpose, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.emailOtp.create({
        data: { email, purpose, codeHash: this.hash(email, purpose, code), payload, expiresAt: new Date(now + TTL_MS) },
        select: { id: true },
      }),
    ]);
    const { instituteName } = await this.settings.publicInfo();
    try {
      await this.sendCode(email, purpose, code, instituteName);
    } catch (err) {
      // Not delivered: forget it so the resend cooldown does not lock the person out.
      await this.prisma.emailOtp.delete({ where: { id: row.id } });
      throw err;
    }
    return true;
  }

  private sendCode(email: string, purpose: OtpPurpose, code: string, instituteName: string) {
    return this.mail.send({
      to: email,
      subject: `${SUBJECT[purpose]}: ${code}`,
      text: `${instituteName}\n\n${LINE[purpose]}\n\nCode: ${code}\n\nThe code works for 10 minutes. Never share it with anyone, not even the institute staff.`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937">
<p style="font-size:17px;font-weight:bold">${escapeHtml(instituteName)}</p>
<p>${LINE[purpose]}</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:18px 0">${code}</p>
<p style="color:#6b7280">The code works for 10 minutes. Never share it with anyone, not even the institute staff.</p></div>`,
    });
  }

  /** Checks the newest code. Wrong tries count; the code is single use. Returns its payload. */
  async verify(email: string, purpose: OtpPurpose, code: string) {
    const otp = await this.prisma.emailOtp.findFirst({
      where: { email, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    const invalid = (message: string) => new BadRequestException({ statusCode: 400, code: 'OTP_INVALID', message });
    if (!otp) throw invalid('The code has expired. Ask for a new one.');
    if (otp.attempts >= MAX_TRIES) throw invalid('Too many wrong tries. Ask for a new code.');

    const given = Buffer.from(this.hash(email, purpose, code.trim()), 'hex');
    const stored = Buffer.from(otp.codeHash, 'hex');
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
      await this.prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw invalid('Wrong code. Check the latest email and try again.');
    }
    // Claim it atomically so two parallel requests cannot both use one code.
    const { count } = await this.prisma.emailOtp.updateMany({
      where: { id: otp.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!count) throw invalid('The code was already used. Ask for a new one.');
    return otp.payload;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** "r****@gmail.com" */
export function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, name.length - 1))}@${domain}`;
}

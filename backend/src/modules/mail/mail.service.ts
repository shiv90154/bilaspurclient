import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../../config/env.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends email through the institute's SMTP account (SMTP_* in the environment).
 * Without SMTP_HOST: development prints the mail to the log so OTPs can still be tested;
 * production refuses with a clear "email is not set up" error.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport?: Transporter;
  private readonly from: string;
  private readonly isProd: boolean;

  constructor(config: ConfigService<Env, true>) {
    this.isProd = config.get('NODE_ENV', { infer: true }) === 'production';
    const host = config.get('SMTP_HOST', { infer: true })?.trim();
    const port = config.get('SMTP_PORT', { infer: true });
    const user = config.get('SMTP_USER', { infer: true })?.trim();
    this.from = config.get('MAIL_FROM', { infer: true })?.trim() || user || 'no-reply@localhost';
    if (host) {
      this.transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // 465 = SSL from the start; 587 upgrades with STARTTLS
        requireTLS: port !== 465,
        auth: user ? { user, pass: config.get('SMTP_PASS', { infer: true }) } : undefined,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
      });
      this.logger.log(`Email enabled via ${host}:${port}`);
    } else {
      this.logger.warn('Email disabled: SMTP_HOST is not set');
    }
  }

  get enabled(): boolean {
    return !!this.transport;
  }

  async send(mail: Mail): Promise<void> {
    if (!this.transport) {
      if (this.isProd) {
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: 'EMAIL_NOT_CONFIGURED',
          message: 'Email is not set up yet. Please contact the institute.',
        });
      }
      this.logger.warn(`[email not configured] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.from, ...mail });
    } catch (err) {
      this.logger.error(`Sending email to ${mail.to} failed: ${String(err)}`);
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'EMAIL_FAILED',
        message: 'Could not send the email right now. Please try again in a few minutes.',
      });
    }
  }
}

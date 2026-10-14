import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import type { Env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface PushMessage {
  title: string;
  body: string;
  /** Delivered to the app as-is; values must be strings (FCM rule). */
  data?: Record<string, string>;
}

const STALE_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * Push kinds a person can switch off in their profile (User.notifyPrefs), by `data.type`.
 * Everything else (class cancelled / rescheduled, document review, test pushes) always arrives.
 */
export const NOTIFY_PREF_BY_TYPE: Record<string, NotifyPref> = {
  class_reminder: 'classReminders',
  video_ready: 'recordings',
  doubt_reply: 'doubtReplies',
  test_result: 'testResults',
};
export const NOTIFY_PREFS = ['classReminders', 'recordings', 'doubtReplies', 'testResults'] as const;
export type NotifyPref = (typeof NOTIFY_PREFS)[number];

/** Stored prefs with defaults filled in (missing = on). */
export function readNotifyPrefs(stored: unknown): Record<NotifyPref, boolean> {
  const obj = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  return Object.fromEntries(NOTIFY_PREFS.map((k) => [k, obj[k] !== false])) as Record<NotifyPref, boolean>;
}

/** FCM allows 500 tokens per multicast call. */
const BATCH = 500;

/**
 * Sends FCM pushes. Does nothing (and says so once) until Firebase credentials are configured, so
 * the rest of the API works without it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private messaging: Messaging | null = null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    const json = config.get('FIREBASE_SERVICE_ACCOUNT_JSON', { infer: true });
    const path = config.get('FIREBASE_SERVICE_ACCOUNT_PATH', { infer: true });
    if (!json && !path) {
      this.logger.warn('FCM disabled: set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON');
      return;
    }
    try {
      const credential = JSON.parse(json || readFileSync(path!, 'utf8')) as Parameters<typeof cert>[0];
      const app: App = getApps()[0] ?? initializeApp({ credential: cert(credential) });
      this.messaging = getMessaging(app);
      this.logger.log('FCM enabled');
    } catch (err) {
      this.logger.error('FCM disabled: invalid Firebase service account', err as Error);
    }
  }

  get enabled() {
    return this.messaging !== null;
  }

  /** Stores (or clears, with null) this device's FCM token. Scoped to the caller's own device. */
  async registerToken(userId: string, deviceId: string, fcmToken: string | null) {
    // A token belongs to exactly one device: drop it elsewhere (app reinstalled / account switched).
    if (fcmToken) {
      await this.prisma.device.updateMany({
        where: { fcmToken, NOT: { userId, deviceId } },
        data: { fcmToken: null },
      });
    }
    const { count } = await this.prisma.device.updateMany({
      where: { userId, deviceId },
      data: { fcmToken },
    });
    return { registered: count > 0 };
  }

  /** Push to every signed-in device of these users. Never throws: a failed push must not fail the action. */
  async sendToUsers(userIds: string[], message: PushMessage): Promise<void> {
    if (!this.messaging || userIds.length === 0) return;
    try {
      const pref = message.data?.type ? NOTIFY_PREF_BY_TYPE[message.data.type] : undefined;
      if (pref) {
        const off = await this.prisma.user.findMany({
          where: { id: { in: userIds }, notifyPrefs: { path: [pref], equals: false } },
          select: { id: true },
        });
        const muted = new Set(off.map((u) => u.id));
        userIds = userIds.filter((id) => !muted.has(id));
        if (userIds.length === 0) return;
      }
      await this.deliver(userIds, message);
    } catch (err) {
      this.logger.error('push failed', err as Error);
    }
  }

  /** Same as sendToUsers, but reports what happened (admin "send a test notification"). */
  async sendWithReport(userIds: string[], message: PushMessage) {
    if (!this.messaging) return { enabled: false, devices: 0, sent: 0, failed: 0, errors: [] as string[] };
    return { enabled: true, ...(await this.deliver(userIds, message)) };
  }

  private async deliver(userIds: string[], message: PushMessage) {
    const devices = await this.prisma.device.findMany({
      where: {
        userId: { in: userIds },
        fcmToken: { not: null },
        // Only devices that are still signed in; a logged-out phone must not get pushes.
        sessions: { some: { revokedAt: null, expiresAt: { gt: new Date() } } },
      },
      select: { fcmToken: true },
    });
    const tokens = [...new Set(devices.map((d) => d.fcmToken!))];
    const total = { devices: tokens.length, sent: 0, failed: 0, errors: [] as string[] };
    for (let i = 0; i < tokens.length; i += BATCH) {
      const r = await this.sendBatch(tokens.slice(i, i + BATCH), message);
      total.sent += r.sent;
      total.failed += r.failed;
      total.errors.push(...r.errors);
    }
    total.errors = [...new Set(total.errors)];
    return total;
  }

  private async sendBatch(tokens: string[], message: PushMessage) {
    const res = await this.messaging!.sendEachForMulticast({
      tokens,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { priority: 'high' },
    });
    const stale = tokens.filter((_, i) => {
      const code = res.responses[i]?.error?.code;
      return code !== undefined && STALE_TOKEN_CODES.has(code);
    });
    if (stale.length) {
      await this.prisma.device.updateMany({ where: { fcmToken: { in: stale } }, data: { fcmToken: null } });
    }
    if (res.failureCount) this.logger.warn(`${res.failureCount}/${tokens.length} pushes failed (${stale.length} stale)`);
    return {
      sent: res.successCount,
      failed: res.failureCount,
      errors: res.responses.flatMap((r) => (r.error ? [r.error.code] : [])),
    };
  }
}

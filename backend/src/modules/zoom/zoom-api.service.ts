import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { hmacHex, sameSignature } from '../fees/razorpay.service.js';

/** One file of a Zoom cloud recording (only the fields we use). */
export interface ZoomRecordingFile {
  id?: string;
  file_type?: string; // MP4, M4A, CHAT, TRANSCRIPT ...
  recording_type?: string; // shared_screen_with_speaker_view, speaker_view ...
  recording_start?: string;
  recording_end?: string;
  file_size?: number;
  download_url?: string;
  status?: string; // completed
}

/** A meeting instance's recording: the `payload.object` of recording.completed, or GET /meetings/{uuid}/recordings. */
export interface ZoomRecording {
  uuid: string;
  id: number | string; // meeting number
  topic?: string;
  start_time?: string;
  duration?: number; // minutes
  recording_files?: ZoomRecordingFile[];
}

/** Webhooks older than this are refused (replay protection). */
const MAX_WEBHOOK_AGE_MS = 5 * 60_000;

/**
 * Zoom Server-to-Server OAuth app: an account-level token (no user login) to read and trash cloud
 * recordings, plus the webhook signature check. Everything is optional: without keys the rest of
 * the app works and Zoom import simply reports "not set up".
 */
@Injectable()
export class ZoomApiService {
  private readonly logger = new Logger(ZoomApiService.name);
  private readonly accountId?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly webhookSecret?: string;
  private readonly apiUrl: string;
  private readonly oauthUrl: string;
  readonly trashAfterImport: boolean;
  private token?: { value: string; expiresAt: number };

  constructor(config: ConfigService<Env, true>) {
    const get = (k: 'ZOOM_ACCOUNT_ID' | 'ZOOM_CLIENT_ID' | 'ZOOM_CLIENT_SECRET' | 'ZOOM_WEBHOOK_SECRET') =>
      config.get(k, { infer: true })?.trim() || undefined;
    this.accountId = get('ZOOM_ACCOUNT_ID');
    this.clientId = get('ZOOM_CLIENT_ID');
    this.clientSecret = get('ZOOM_CLIENT_SECRET');
    this.webhookSecret = get('ZOOM_WEBHOOK_SECRET');
    this.apiUrl = config.get('ZOOM_API_URL', { infer: true }).replace(/\/$/, '');
    this.oauthUrl = config.get('ZOOM_OAUTH_URL', { infer: true });
    this.trashAfterImport = config.get('ZOOM_TRASH_AFTER_IMPORT', { infer: true });
    if (this.apiEnabled || this.webhookEnabled) {
      this.logger.log(`Zoom recordings: API ${this.apiEnabled ? 'on' : 'off'}, webhook ${this.webhookEnabled ? 'on' : 'off'}`);
    }
  }

  get apiEnabled(): boolean {
    return !!(this.accountId && this.clientId && this.clientSecret);
  }

  get webhookEnabled(): boolean {
    return !!this.webhookSecret;
  }

  // ───────────── webhook ─────────────

  /** x-zm-signature = "v0=" + HMAC(secret, "v0:{timestamp}:{raw body}"). */
  checkWebhook(rawBody: Buffer, timestamp: string | undefined, signature: string | undefined): boolean {
    if (!this.webhookSecret || !timestamp || !signature) return false;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > MAX_WEBHOOK_AGE_MS) return false;
    return sameSignature(`v0=${hmacHex(this.webhookSecret, `v0:${timestamp}:${rawBody.toString('utf8')}`)}`, signature);
  }

  /** Zoom checks the URL when it is saved (and every 72h): echo the token, signed. */
  urlValidation(plainToken: string) {
    return { plainToken, encryptedToken: hmacHex(this.webhookSecret ?? '', plainToken) };
  }

  // ───────────── REST ─────────────

  private assertApi() {
    if (!this.apiEnabled) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: 'ZOOM_NOT_CONFIGURED',
        message: 'Zoom is not connected yet: set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET on the server.',
      });
    }
  }

  async accessToken(): Promise<string> {
    this.assertApi();
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const url = new URL(this.oauthUrl);
    url.searchParams.set('grant_type', 'account_credentials');
    url.searchParams.set('account_id', this.accountId!);
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; reason?: string };
    if (!res.ok || !body.access_token) {
      this.logger.error(`Zoom token failed: ${res.status} ${body.reason ?? ''}`);
      throw new BadGatewayException('Zoom refused the app credentials (check ZOOM_ACCOUNT_ID / CLIENT_ID / CLIENT_SECRET)');
    }
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  /** null on 404 (no such meeting / no recording). */
  private async call<T>(method: 'GET' | 'DELETE', path: string): Promise<T | null> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${await this.accessToken()}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(`Zoom ${method} ${path.split('?')[0]} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.status === 204 ? ({} as T) : ((await res.json()) as T);
  }

  /** Past instances of a meeting number (a weekly meeting has one per class). */
  async pastInstances(meetingId: string): Promise<{ uuid: string; start_time: string }[]> {
    const r = await this.call<{ meetings?: { uuid: string; start_time: string }[] }>('GET', `/past_meetings/${meetingId}/instances`);
    return r?.meetings ?? [];
  }

  /** `idOrUuid`: a meeting instance uuid, or a meeting number (= its latest instance). */
  async recording(idOrUuid: string): Promise<ZoomRecording | null> {
    return this.call<ZoomRecording>('GET', `/meetings/${encodeMeetingUuid(idOrUuid)}/recordings`);
  }

  /** Moves the recording to Zoom's trash (recoverable there for 30 days). */
  async trashRecording(uuid: string): Promise<void> {
    await this.call('DELETE', `/meetings/${encodeMeetingUuid(uuid)}/recordings?action=trash`);
  }
}

/** Zoom's rule: a uuid starting with "/" or containing "//" must be URL-encoded twice. */
export function encodeMeetingUuid(uuid: string): string {
  const once = encodeURIComponent(uuid);
  return uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(once) : once;
}

/** Meeting number from a Zoom join link (zoom.us/j/123..., /w/, /s/, /wc/join/), else null. */
export function zoomMeetingId(joinUrl: string | null | undefined): string | null {
  if (!joinUrl) return null;
  try {
    const u = new URL(joinUrl);
    if (!/(^|\.)zoom\.(us|com)$/.test(u.hostname)) return null;
    return u.pathname.match(/^\/(?:j|w|s|wc\/join)\/(\d{9,12})(?:\/|$)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

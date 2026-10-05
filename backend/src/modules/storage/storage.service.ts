import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

/** Keys we generate ourselves; anything else is rejected before touching the disk (no path traversal). */
const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|apk)$/;

export type Disposition = 'inline' | 'attachment';

/**
 * Private file storage on local disk. Files are never served by a permanent URL:
 * callers hand out short-lived HMAC-signed links instead (`signedUrl`).
 * Swapping to S3 later only means re-implementing put/open/remove.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly secret: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('STORAGE_DIR', { infer: true }));
    // Derived key: a leaked file link can never be turned into a JWT or the other way round.
    this.secret = createHmac('sha256', config.get('JWT_ACCESS_SECRET', { infer: true }))
      .update('file-urls')
      .digest();
  }

  async onModuleInit() {
    await mkdir(this.root, { recursive: true });
    this.logger.log(`File storage: ${this.root}`);
  }

  /** Stores the bytes under a fresh random key and returns the key. */
  async put(buffer: Buffer, ext: 'pdf' | 'apk'): Promise<string> {
    const key = `${randomUUID()}.${ext}`;
    await writeFile(this.pathOf(key), buffer, { flag: 'wx' });
    return key;
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  async open(key: string) {
    const path = this.pathOf(key);
    const info = await stat(path); // throws ENOENT if missing
    return { stream: createReadStream(path), size: info.size };
  }

  /** Relative URL (`/api/files/...`); clients prepend the API base. Valid for `ttlSeconds`. */
  signedUrl(key: string, fileName: string, disposition: Disposition, ttlSeconds = 180): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(key, exp, disposition, fileName);
    const q = new URLSearchParams({ exp: String(exp), d: disposition, n: fileName, sig });
    return `/api/files/${key}?${q.toString()}`;
  }

  verify(key: string, exp: number, disposition: string, fileName: string, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    if (disposition !== 'inline' && disposition !== 'attachment') return false;
    const expected = Buffer.from(this.sign(key, exp, disposition, fileName), 'hex');
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  private sign(key: string, exp: number, disposition: string, fileName: string): string {
    return createHmac('sha256', this.secret)
      .update(`${key}|${exp}|${disposition}|${fileName}`)
      .digest('hex');
  }

  private pathOf(key: string): string {
    if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
    return resolve(this.root, key);
  }

  isValidKey(key: string): boolean {
    return KEY_RE.test(key);
  }
}

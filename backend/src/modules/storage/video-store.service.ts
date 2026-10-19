import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { StorageService } from './storage.service.js';

export type VideoStoreName = 'local' | 'r2';

/** A play link must outlive the lecture: players keep seeking (new Range requests) with the same URL. */
const PLAY_TTL_SECONDS = 6 * 3600;

/**
 * Where recorded lectures (mp4) live. "local" = STORAGE_DIR, served by /api/files with signed
 * links; "r2" = a private Cloudflare R2 bucket, played from presigned links (R2 does not charge
 * for bandwidth). Every video remembers its own store, so switching VIDEO_STORE later is safe.
 */
@Injectable()
export class VideoStoreService {
  private readonly logger = new Logger(VideoStoreService.name);
  private readonly target: VideoStoreName;
  private readonly r2?: S3Client;
  private readonly bucket?: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly files: StorageService,
  ) {
    const get = (k: 'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY' | 'R2_BUCKET' | 'R2_ENDPOINT') =>
      config.get(k, { infer: true })?.trim() || undefined;
    const accountId = get('R2_ACCOUNT_ID');
    const accessKeyId = get('R2_ACCESS_KEY_ID');
    const secretAccessKey = get('R2_SECRET_ACCESS_KEY');
    const endpoint = get('R2_ENDPOINT') ?? (accountId && `https://${accountId}.r2.cloudflarestorage.com`);
    this.bucket = get('R2_BUCKET');
    if (endpoint && accessKeyId && secretAccessKey && this.bucket) {
      this.r2 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        // R2 rejects some of the SDK's newer default checksums; only send them when an API needs one.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    }
    this.target = config.get('VIDEO_STORE', { infer: true });
    if (this.target === 'r2' && !this.r2) {
      throw new Error('VIDEO_STORE=r2 needs R2_ACCOUNT_ID (or R2_ENDPOINT), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET');
    }
    this.logger.log(`New videos are stored in: ${this.target === 'r2' ? `R2 bucket ${this.bucket}` : 'local disk'}`);
  }

  get current(): VideoStoreName {
    return this.target;
  }

  get r2Configured(): boolean {
    return !!this.r2;
  }

  /** A scratch file to download into before `save` (on the storage disk). */
  tmpPath(): string {
    return this.files.tmpPath();
  }

  /** Where a chunked admin upload collects its bytes (`part`) and remembers its expected size (`json`). */
  uploadPath(id: string, ext: 'part' | 'json'): string {
    return this.files.uploadPath(id, ext);
  }

  /** Moves a finished mp4 from `tmpPath()` into the current store. The temp file is gone afterwards. */
  async save(tmp: string): Promise<{ store: VideoStoreName; key: string }> {
    if (this.target === 'local') return { store: 'local', key: await this.files.putFile(tmp, 'mp4') };
    const key = `videos/${randomUUID()}.mp4`;
    try {
      await new Upload({
        client: this.r2!,
        params: { Bucket: this.bucket, Key: key, Body: createReadStream(tmp), ContentType: 'video/mp4' },
        partSize: 16 * 1024 * 1024,
        queueSize: 4,
      }).done();
    } finally {
      await rm(tmp, { force: true });
    }
    return { store: 'r2', key };
  }

  /** Local: relative `/api/files/...` (clients prepend the API base). R2: an absolute https link. */
  async playUrl(store: string | null, key: string, fileName: string): Promise<string> {
    if (store === 'r2') {
      if (!this.r2) throw new Error('This video is on R2 but the R2 keys are not set');
      return getSignedUrl(this.r2, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: PLAY_TTL_SECONDS });
    }
    return this.files.signedUrl(key, fileName, 'inline', PLAY_TTL_SECONDS);
  }

  async remove(store: string | null, key: string): Promise<void> {
    if (store === 'r2') {
      if (this.r2) await this.r2.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return;
    }
    await this.files.remove(key);
  }
}

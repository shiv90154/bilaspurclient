import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGINS: z.string().default('http://localhost:3001'),

  // Private uploads (notes PDFs). Keep outside the web root; back it up with the DB.
  STORAGE_DIR: z.string().default('./storage'),

  // FCM push (optional). Firebase console > Project settings > Service accounts > Generate key.
  // Either the path to the JSON file, or the JSON itself (handy for Docker secrets).
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Email (OTP for sign-up and forgot password). Any SMTP provider. Without SMTP_HOST, codes are
  // printed to the backend log in development and email features answer "not set up" in production.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(), // e.g. "DHĪ <no-reply@example.com>"

  // Online fees on the website (Razorpay dashboard > Account & Settings > API keys / Webhooks).
  // Without the keys online payment answers "not set up"; offline entries still work.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_API_URL: z.string().url().default('https://api.razorpay.com/v1'), // overridden only by smoke tests

  // Zoom cloud recordings → our storage → the class's batch (docs/14-zoom-recordings.md).
  // marketplace.zoom.us > Build App > Server-to-Server OAuth: Account ID, Client ID, Client Secret.
  // Its "Event Subscriptions" > Secret Token goes in ZOOM_WEBHOOK_SECRET. Empty = Zoom import off.
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_WEBHOOK_SECRET: z.string().optional(),
  // After a successful copy, move the recording to Zoom's trash (kept there 30 days) to free the 5GB.
  ZOOM_TRASH_AFTER_IMPORT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ZOOM_API_URL: z.string().url().default('https://api.zoom.us/v2'), // overridden only by smoke tests
  ZOOM_OAUTH_URL: z.string().url().default('https://zoom.us/oauth/token'),

  // Where imported videos live: "local" = STORAGE_DIR on this server, "r2" = Cloudflare R2
  // (10GB free, no bandwidth charges). Switching later keeps old videos where they are.
  VIDEO_STORE: z.enum(['local', 'r2']).default('local'),
  // Cloudflare dashboard > R2 > Manage API tokens (Object Read & Write on the bucket).
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(), // default https://<account>.r2.cloudflarestorage.com

  DEVICE_CHANGE_LIMIT_30D: z.coerce.number().int().positive().default(3),
  LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),

  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  return parsed.data;
}

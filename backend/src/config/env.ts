import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('info'),

CORS_ORIGINS: z.string().default('http://localhost:3000,https://sync-main.vercel.app'),
  APP_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  MONGO_URI: z.string().min(1, 'MONGO_URI required'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_RESET_SECRET: z.string().min(16),
  JWT_INVITE_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  RESET_TOKEN_TTL: z.string().default('30m'),
  INVITE_TOKEN_TTL: z.string().default('7d'),

  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
  .string()
  .transform((v) => v === 'true')
  .default('true'),
  /**
   * Path the refresh cookie is scoped to.
   *
   * Defaults to `/api/auth` — fine when the API is at the site root.
   * On the Vercel single-deploy with backend mounted at `/_/backend`, the BROWSER
   * sees the auth URL as `/_/backend/api/auth/refresh`, so the cookie must be
   * scoped there or the browser won't send it back. Set to `/_/backend/api/auth`.
   */
  COOKIE_PATH: z.string().default('/api/auth'),
  /**
   * Override SameSite — `lax` (same-origin, default for Vercel single-deploy)
   * or `none` (cross-origin like Vercel + Render).
   * If unset, we pick based on COOKIE_SECURE: `none` in secure mode, `lax` otherwise.
   */
 COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('none'),

  // === Storage ===
  // `cloudinary` (default for prod) or `s3` (MinIO/S3 for local Docker dev).
  STORAGE_PROVIDER: z.enum(['cloudinary', 's3']).default('cloudinary'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('sync'),

  S3_ENDPOINT: z.string().optional(),                  // MinIO: http://localhost:9000
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('sync'),
  S3_ACCESS_KEY: z.string().optional(),                // MinIO root: minioadmin
  S3_SECRET_KEY: z.string().optional(),                // MinIO root: minioadmin
  S3_FORCE_PATH_STYLE: z.string().transform((v) => v !== 'false').default('true'),
  S3_PUBLIC_URL_BASE: z.string().optional(),           // e.g. http://localhost:9000/sync

  // === Email ===
  // `resend` (default for prod) or `smtp` (Mailpit/local for dev).
  EMAIL_PROVIDER: z.enum(['resend', 'smtp', 'console']).default('console'),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('SYNC <noreply@example.com>'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_FROM: z.string().default('SYNC <noreply@example.com>'),

  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),

  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(5),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Environment validation failed');
}

export const env = {
  ...parsed.data,
  CORS_ORIGINS_LIST: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};

export type Env = typeof env;

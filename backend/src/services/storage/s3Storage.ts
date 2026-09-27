/**
 * S3-compatible storage. Works with both AWS S3 and any S3-compatible store like
 * MinIO (our docker-compose default). Path-style addressing is forced so MinIO's
 * `http://host:9000/bucket/key` URLs work without DNS hosts-of-buckets.
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { StorageProvider, UploadParams, UploadResult } from './types';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
    logger.warn('S3 credentials missing — uploads will fail');
  }
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY || '',
      secretAccessKey: env.S3_SECRET_KEY || '',
    },
  });
  return client;
}

function publicUrl(key: string): string {
  // If S3_PUBLIC_URL_BASE is set (e.g. http://localhost:9000/sync), prefer it —
  // useful when the public URL differs from the internal endpoint (CDN, reverse proxy, etc.).
  if (env.S3_PUBLIC_URL_BASE) return `${env.S3_PUBLIC_URL_BASE.replace(/\/$/, '')}/${key}`;
  const base = env.S3_ENDPOINT?.replace(/\/$/, '') ?? `https://s3.${env.S3_REGION}.amazonaws.com`;
  return env.S3_FORCE_PATH_STYLE
    ? `${base}/${env.S3_BUCKET}/${key}`
    : `${base.replace('://', `://${env.S3_BUCKET}.`)}/${key}`;
}

export const s3Storage: StorageProvider = {
  name: 's3',

  async upload({ buffer, folder, filename, mimeType }: UploadParams): Promise<UploadResult> {
    const ext = path.extname(filename) || '';
    const safeStem = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const key = `${folder}/${randomUUID()}-${safeStem}${ext}`;

    await getClient().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // We don't ACL per-object — the bucket policy (set by minio-init in docker-compose)
        // makes the whole bucket downloadable. For real AWS, switch to pre-signed URLs only.
      }),
    );

    return {
      url: publicUrl(key),
      publicId: key,
      resourceType: mimeType.startsWith('image/') ? 'image' : 'raw',
      size: buffer.length,
    };
  },

  async delete({ publicId }) {
    try {
      await getClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: publicId }));
    } catch (err) {
      logger.warn({ err, publicId }, 'S3 delete failed');
    }
  },

  async signedDownloadUrl(file) {
    // Always return a fresh signed URL — works even when the bucket isn't public,
    // and lets us force `Content-Disposition: attachment` for non-images.
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: file.publicId,
      ResponseContentDisposition:
        file.resourceType !== 'image' ? `attachment; filename="${file.filename}"` : undefined,
    });
    try {
      return await getSignedUrl(getClient(), command, { expiresIn: 300 });
    } catch (err) {
      logger.warn({ err }, 'S3 signed URL failed, falling back to direct URL');
      return file.url;
    }
  },
};

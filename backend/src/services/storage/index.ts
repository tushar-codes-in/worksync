import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { cloudinaryStorage } from './cloudinaryStorage';
import { s3Storage } from './s3Storage';
import type { StorageProvider } from './types';

export type { StorageProvider, UploadParams, UploadResult, StoredFileRef, StorageResourceType } from './types';

let active: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (active) return active;
  active = env.STORAGE_PROVIDER === 's3' ? s3Storage : cloudinaryStorage;
  logger.info({ provider: active.name }, 'Storage provider initialized');
  return active;
}

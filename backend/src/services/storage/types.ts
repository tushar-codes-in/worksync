/**
 * Storage abstraction. Lets file uploads route to Cloudinary (prod) or MinIO/S3
 * (local Docker dev) via a single env var, without controllers knowing the difference.
 */

export type StorageResourceType = 'image' | 'video' | 'raw' | 'auto';

export interface UploadParams {
  buffer: Buffer;
  folder: string;        // e.g. project id
  filename: string;
  mimeType: string;
}

export interface UploadResult {
  url: string;           // canonical URL the browser can hit (or a placeholder for `signed download` style providers)
  publicId: string;      // provider-internal id, used for delete + signed-download
  resourceType: StorageResourceType;
  size: number;
}

export interface StoredFileRef {
  url: string;
  publicId: string;
  resourceType: StorageResourceType;
  filename: string;
  mimeType: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(params: UploadParams): Promise<UploadResult>;
  delete(file: Pick<StoredFileRef, 'publicId' | 'resourceType'>): Promise<void>;
  /** Returns a short-lived URL the browser can be 302'd to. */
  signedDownloadUrl(file: StoredFileRef): Promise<string>;
}

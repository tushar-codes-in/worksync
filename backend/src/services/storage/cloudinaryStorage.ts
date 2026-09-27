import { getCloudinary } from '../../config/cloudinary';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { StorageProvider, UploadParams, UploadResult } from './types';

export const cloudinaryStorage: StorageProvider = {
  name: 'cloudinary',

  async upload({ buffer, folder, mimeType }: UploadParams): Promise<UploadResult> {
    const cloud = getCloudinary();
    const resourceType = mimeType.startsWith('image/') ? 'image' : 'raw';

    const upload = await new Promise<any>((resolve, reject) => {
      const stream = cloud.uploader.upload_stream(
        {
          folder: `${env.CLOUDINARY_UPLOAD_FOLDER}/${folder}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      stream.end(buffer);
    });

    return {
      url: upload.secure_url,
      publicId: upload.public_id,
      resourceType,
      size: upload.bytes ?? buffer.length,
    };
  },

  async delete({ publicId, resourceType }) {
    const cloud = getCloudinary();
    await cloud.uploader.destroy(publicId, { resource_type: resourceType }).catch((err) => {
      logger.warn({ err, publicId }, 'Cloudinary destroy failed');
    });
  },

  async signedDownloadUrl(file) {
    const cloud = getCloudinary();
    try {
      return cloud.utils.private_download_url(file.publicId, '', {
        resource_type: file.resourceType,
        expires_at: Math.floor(Date.now() / 1000) + 300,
        attachment: file.resourceType !== 'image',
      });
    } catch (err) {
      logger.warn({ err }, 'Cloudinary signed URL failed, falling back to direct URL');
      return file.url;
    }
  },
};

import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';
import { logger } from './logger';

let configured = false;

export function getCloudinary() {
  if (!configured) {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      logger.warn('Cloudinary credentials missing — uploads will fail');
    }
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

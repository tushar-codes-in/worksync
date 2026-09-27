import multer from 'multer';
import { MAX_FILE_BYTES } from '../services/fileService';

// Buffer-only — we forward to Cloudinary's upload_stream so nothing hits local disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 5 },
});

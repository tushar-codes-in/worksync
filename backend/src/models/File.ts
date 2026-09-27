import { Schema, model, type Document, type Types } from 'mongoose';

/**
 * Each upload lives in its own record so we can:
 *   - enforce per-project ACL on download (resolve task->project ownership)
 *   - delete from Cloudinary by publicId on cleanup
 *   - audit who uploaded what
 */
export interface FileDoc extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  task?: Types.ObjectId;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  publicId: string;
  resourceType: 'image' | 'video' | 'raw' | 'auto';
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

const fileSchema = new Schema<FileDoc>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task', index: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ['image', 'video', 'raw', 'auto'], default: 'auto' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const File = model<FileDoc>('File', fileSchema);

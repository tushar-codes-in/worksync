import mongoose, { Schema, model, type Document, type Types } from 'mongoose';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskAttachment {
  fileId: Types.ObjectId;
  url: string;
  publicId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface TaskComment {
  _id?: Types.ObjectId;
  text: string;
  author: Types.ObjectId;
  mentions: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TaskDoc extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: Types.ObjectId[];
  dueDate?: Date;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<TaskAttachment>(
  {
    fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const commentSchema = new Schema<TaskComment>(
  {
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentions: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true },
);

const taskSchema = new Schema<TaskDoc>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 10_000 },
    status: { type: String, enum: ['todo', 'in_progress', 'review', 'completed'], default: 'todo', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
    assignees: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [], index: true },
    dueDate: { type: Date, index: true },
    attachments: { type: [attachmentSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

taskSchema.index({ project: 1, status: 1, priority: 1 });
taskSchema.index({ project: 1, updatedAt: -1 });
taskSchema.index({ project: 1, dueDate: 1 });
taskSchema.index({ title: 'text', description: 'text' });

export const Task = model<TaskDoc>('Task', taskSchema);
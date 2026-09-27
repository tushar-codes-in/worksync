import { Types } from 'mongoose';
import { File as FileModel, type FileDoc } from '../models/File';
import { Task } from '../models/Task';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';
import { env } from '../config/env';
import { logActivity } from './activityService';
import { getStorage } from './storage';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
]);

export const MAX_FILE_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;

export function assertAllowed(mimeType: string, size: number) {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new BadRequestError(`Unsupported file type: ${mimeType}`);
  }
  if (size > MAX_FILE_BYTES) {
    throw new BadRequestError(`File exceeds ${env.MAX_FILE_SIZE_MB}MB limit`);
  }
}

export async function uploadFile(opts: {
  projectId: string;
  taskId?: string;
  actorId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}) {
  assertAllowed(opts.mimeType, opts.size);
  if (opts.taskId) {
    const t = await Task.exists({ _id: opts.taskId, project: opts.projectId });
    if (!t) throw new NotFoundError('Task not found in this project');
  }

  const storage = getStorage();
  const result = await storage.upload({
    buffer: opts.buffer,
    folder: opts.projectId,
    filename: opts.filename,
    mimeType: opts.mimeType,
  });

  const fileDoc = await FileModel.create({
    project: new Types.ObjectId(opts.projectId),
    task: opts.taskId ? new Types.ObjectId(opts.taskId) : undefined,
    filename: opts.filename,
    mimeType: opts.mimeType,
    size: result.size,
    url: result.url,
    publicId: result.publicId,
    resourceType: result.resourceType,
    uploadedBy: new Types.ObjectId(opts.actorId),
  });

  if (opts.taskId) {
    await Task.findByIdAndUpdate(opts.taskId, {
      $push: {
        attachments: {
          fileId: fileDoc._id,
          url: fileDoc.url,
          publicId: fileDoc.publicId,
          filename: fileDoc.filename,
          size: fileDoc.size,
          mimeType: fileDoc.mimeType,
          uploadedBy: fileDoc.uploadedBy,
          uploadedAt: new Date(),
        },
      },
      $inc: { version: 1 },
    });
    await logActivity({
      project: opts.projectId,
      actor: opts.actorId,
      action: 'task.attachment_added',
      target: { kind: 'task', id: opts.taskId },
      metadata: { filename: fileDoc.filename, size: fileDoc.size },
    });
  }

  return fileDoc;
}

export async function listFiles(projectId: string, taskId?: string) {
  const q: Record<string, unknown> = { project: projectId };
  if (taskId) q.task = taskId;
  return FileModel.find(q).sort({ createdAt: -1 }).populate('uploadedBy', 'name email avatarUrl').lean();
}

export async function getFileMeta(projectId: string, fileId: string) {
  const file = await FileModel.findOne({ _id: fileId, project: projectId }).lean();
  if (!file) throw new NotFoundError('File not found');
  return file;
}

export async function signedDownloadUrl(file: Awaited<ReturnType<typeof getFileMeta>>) {
  return getStorage().signedDownloadUrl({
    url: file.url,
    publicId: file.publicId,
    resourceType: file.resourceType,
    filename: file.filename,
    mimeType: file.mimeType,
  });
}

export async function deleteFile(projectId: string, fileId: string, actorId: string, isAdmin: boolean) {
  const file = await FileModel.findOne({ _id: fileId, project: projectId });
  if (!file) throw new NotFoundError('File not found');
  if (!isAdmin && String(file.uploadedBy) !== actorId) {
    throw new ForbiddenError('You can only delete files you uploaded');
  }

  await getStorage().delete({ publicId: file.publicId, resourceType: file.resourceType });

  if (file.task) {
    await Task.findByIdAndUpdate(file.task, {
      $pull: { attachments: { fileId: file._id } },
      $inc: { version: 1 },
    });
    await logActivity({
      project: projectId,
      actor: actorId,
      action: 'task.attachment_removed',
      target: { kind: 'task', id: file.task },
      metadata: { filename: file.filename },
    });
  }
  await file.deleteOne();
}

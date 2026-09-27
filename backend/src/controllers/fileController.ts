import { asyncHandler } from '../utils/asyncHandler';
import { created, noContent, ok } from '../utils/apiResponse';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import * as svc from '../services/fileService';
import { emitToProject } from '../sockets/emit';

export const upload = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();
  const file = req.file;
  if (!file) throw new BadRequestError('No file uploaded (field "file")');
  const taskId = (req.body?.taskId as string | undefined) || undefined;
  const doc = await svc.uploadFile({
    projectId: req.projectId!,
    taskId,
    actorId: req.user.id,
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  });
  if (taskId) {
    emitToProject(req.projectId!, 'task:attachment_added', { taskId, file: doc.toJSON() });
  }
  return created(res, doc.toJSON());
});

export const list = asyncHandler(async (req, res) => {
  const items = await svc.listFiles(req.projectId!, req.query.taskId as string | undefined);
  return ok(res, items);
});

export const download = asyncHandler(async (req, res) => {
  const file = await svc.getFileMeta(req.projectId!, req.params.fileId);
  const url = await svc.signedDownloadUrl(file);
  // Redirect to Cloudinary signed URL — keeps backend out of the bytes path.
  return res.redirect(302, url);
});

export const remove = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();
  const isAdmin = req.projectRole === 'admin';
  await svc.deleteFile(req.projectId!, req.params.fileId, req.user.id, isAdmin);
  emitToProject(req.projectId!, 'task:attachment_removed', { fileId: req.params.fileId });
  return noContent(res);
});

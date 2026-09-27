import { asyncHandler } from '../utils/asyncHandler';
import { created, noContent, ok } from '../utils/apiResponse';
import { UnauthorizedError } from '../utils/errors';
import * as svc from '../services/taskService';
import { emitToProject } from '../sockets/emit';
import { Task } from '../models/Task';

export const list = asyncHandler(async (req, res) => {
  const { status, priority, assignee, search, sort, page, limit } = req.query as any;
  const result = await svc.listTasks({
    projectId: req.projectId!,
    status,
    priority,
    assignee,
    search,
    sort,
    page,
    limit,
  });

  return ok(res, result.items, {
    page,
    limit,
    total: result.total,
    totalPages: Math.ceil(result.total / limit),
  });
});

export const detail = asyncHandler(async (req, res) => {
  const task = await svc.getTask(req.projectId!, req.params.taskId);
  return ok(res, task);
});

export const create = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const task = await svc.createTask(req.projectId!, req.user.id, req.body);
  emitToProject(req.projectId!, 'task:created', { task: task.toJSON() });

  return created(res, task.toJSON());
});

export const update = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const task = await svc.updateTask(req.projectId!, req.params.taskId, req.user.id, req.body);
  emitToProject(req.projectId!, 'task:updated', { task: task.toJSON() });

  return ok(res, task.toJSON());
});

export const remove = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  await svc.deleteTask(req.projectId!, req.params.taskId, req.user.id);
  emitToProject(req.projectId!, 'task:deleted', { taskId: req.params.taskId });

  return noContent(res);
});

export const bulkUpdate = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const result = await svc.bulkUpdate(req.projectId!, req.user.id, req.body.taskIds, req.body.patch);
  emitToProject(req.projectId!, 'task:bulk_updated', {
    taskIds: req.body.taskIds,
    patch: req.body.patch,
  });

  return ok(res, result);
});

export const bulkDelete = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const result = await svc.bulkDelete(req.projectId!, req.user.id, req.body.taskIds);
  emitToProject(req.projectId!, 'task:bulk_deleted', { taskIds: req.body.taskIds });

  return ok(res, result);
});

export const addComment = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const { text, mentions = [] } = req.body as {
    text?: string;
    mentions?: string[];
  };

  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  const task = await Task.findOne({
    _id: req.params.taskId,
    project: req.projectId!,
  });

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  task.comments.push({
    text: text.trim(),
    author: req.user.id as any,
    mentions: mentions as any,
  });

  task.updatedBy = req.user.id as any;
  task.version += 1;

  await task.save();

  const updatedTask = await Task.findById(task._id)
    .populate('assignees', 'name email avatarUrl')
    .populate('comments.author', 'name email avatarUrl')
    .populate('comments.mentions', 'name email avatarUrl');

  emitToProject(req.projectId!, 'task:updated', { task: updatedTask?.toJSON() });

  return ok(res, updatedTask?.toJSON());
});
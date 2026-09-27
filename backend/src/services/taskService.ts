import { Types } from 'mongoose';
import { Task, type TaskDoc } from '../models/Task';
import { Notification } from '../models/Notification';
import { Project } from '../models/Project';
import { logActivity } from './activityService';
import { ConflictError, NotFoundError } from '../utils/errors';
import { memoryCache, cacheKey } from '../cache/memoryCache';

const TASK_LIST_TTL = 15;

export interface ListOpts {
  projectId: string;
  status?: string;
  priority?: string;
  assignee?: string;
  search?: string;
  sort: string;
  page: number;
  limit: number;
}

function invalidateTaskCache(projectId: string) {
  memoryCache.invalidatePrefix(`tasks:${projectId}`);
}

export async function listTasks(opts: ListOpts) {
  const key = cacheKey(
    'tasks',
    opts.projectId,
    opts.status ?? '',
    opts.priority ?? '',
    opts.assignee ?? '',
    opts.search ?? '',
    opts.sort,
    opts.page,
    opts.limit,
  );
  const cached = memoryCache.get<{ items: unknown[]; total: number }>(key);
  if (cached) return cached;

  const filter: Record<string, unknown> = { project: new Types.ObjectId(opts.projectId) };
  if (opts.status) filter.status = opts.status;
  if (opts.priority) filter.priority = opts.priority;
  if (opts.assignee) filter.assignees = new Types.ObjectId(opts.assignee);
  if (opts.search) {
 
    filter.$or = [
      { title: { $regex: opts.search, $options: 'i' } },
      { description: { $regex: opts.search, $options: 'i' } },
    ];
  }

  const sortObj: Record<string, 1 | -1> = {};
  const field = opts.sort.replace(/^-/, '');
  sortObj[field] = opts.sort.startsWith('-') ? -1 : 1;

  const [items, total] = await Promise.all([
    Task.find(filter)
      .sort(sortObj)
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .populate('assignees', 'name email avatarUrl')
.populate('createdBy', 'name email avatarUrl')
.populate('comments.author', 'name email avatarUrl')
.populate('comments.mentions', 'name email avatarUrl')
.lean(),
    Task.countDocuments(filter),
  ]);

  const result = { items, total };
  memoryCache.set(key, result, TASK_LIST_TTL);
  return result;
}

export async function getTask(projectId: string, taskId: string) {
  const task = await Task.findOne({ _id: taskId, project: projectId })
   .populate('assignees', 'name email avatarUrl')
.populate('createdBy', 'name email avatarUrl')
.populate('updatedBy', 'name email avatarUrl')
.populate('comments.author', 'name email avatarUrl')
.populate('comments.mentions', 'name email avatarUrl')
.lean();
  if (!task) throw new NotFoundError('Task not found');
  return task;
}

export async function createTask(projectId: string, actorId: string, input: Partial<TaskDoc>): Promise<TaskDoc> {
  const task = await Task.create({
    project: new Types.ObjectId(projectId),
    title: input.title!,
    description: input.description,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    assignees: input.assignees ?? [],
    dueDate: input.dueDate,
    createdBy: new Types.ObjectId(actorId),
    updatedBy: new Types.ObjectId(actorId),
    version: 0,
  });
  invalidateTaskCache(projectId);
  await logActivity({
    project: projectId,
    actor: actorId,
    action: 'task.created',
    target: { kind: 'task', id: task._id },
    metadata: { title: task.title, status: task.status, priority: task.priority },
  });
  await notifyAssignees(projectId, actorId, task);
  return task;
}

export interface UpdateInput {
  title?: string;
  description?: string;
  status?: TaskDoc['status'];
  priority?: TaskDoc['priority'];
  assignees?: string[];
  dueDate?: Date | null;
  expectedVersion?: number;
}

export async function updateTask(projectId: string, taskId: string, actorId: string, input: UpdateInput): Promise<TaskDoc> {
  const filter: Record<string, unknown> = { _id: taskId, project: projectId };
  if (typeof input.expectedVersion === 'number') filter.version = input.expectedVersion;

  const $set: Record<string, unknown> = { updatedBy: new Types.ObjectId(actorId) };
  if (input.title !== undefined) $set.title = input.title;
  if (input.description !== undefined) $set.description = input.description;
  if (input.status !== undefined) $set.status = input.status;
  if (input.priority !== undefined) $set.priority = input.priority;
  if (input.assignees !== undefined) $set.assignees = input.assignees.map((id) => new Types.ObjectId(id));
  if (input.dueDate !== undefined) $set.dueDate = input.dueDate;

  const updated = await Task.findOneAndUpdate(
    filter,
    { $set, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );

  if (!updated) {

    const exists = await Task.exists({ _id: taskId, project: projectId });
    if (!exists) throw new NotFoundError('Task not found');
    throw new ConflictError('Task was modified by someone else — please reload', { code: 'VERSION_CONFLICT' });
  }

  invalidateTaskCache(projectId);

  const action = input.status !== undefined ? 'task.status_changed' : 'task.updated';
  await logActivity({
    project: projectId,
    actor: actorId,
    action,
    target: { kind: 'task', id: updated._id },
    metadata: input as Record<string, unknown>,
  });

  if (input.assignees !== undefined) {
    await notifyAssignees(projectId, actorId, updated);
  }

  return updated;
}

export async function deleteTask(projectId: string, taskId: string, actorId: string) {
  const task = await Task.findOneAndDelete({ _id: taskId, project: projectId });
  if (!task) throw new NotFoundError('Task not found');
  invalidateTaskCache(projectId);
  await logActivity({
    project: projectId,
    actor: actorId,
    action: 'task.deleted',
    target: { kind: 'task', id: task._id },
    metadata: { title: task.title },
  });
  return task;
}

export async function bulkUpdate(projectId: string, actorId: string, taskIds: string[], patch: { status?: string; priority?: string; assignees?: string[] }) {
  const $set: Record<string, unknown> = { updatedBy: new Types.ObjectId(actorId) };
  if (patch.status !== undefined) $set.status = patch.status;
  if (patch.priority !== undefined) $set.priority = patch.priority;
  if (patch.assignees !== undefined) $set.assignees = patch.assignees.map((id) => new Types.ObjectId(id));

  const result = await Task.updateMany(
    { _id: { $in: taskIds.map((id) => new Types.ObjectId(id)) }, project: projectId },
    { $set, $inc: { version: 1 } },
  );
  invalidateTaskCache(projectId);
  await logActivity({
    project: projectId,
    actor: actorId,
    action: 'task.bulk_updated',
    metadata: { count: result.modifiedCount, taskIds, patch },
  });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export async function bulkDelete(projectId: string, actorId: string, taskIds: string[]) {
  const result = await Task.deleteMany({
    _id: { $in: taskIds.map((id) => new Types.ObjectId(id)) },
    project: projectId,
  });
  invalidateTaskCache(projectId);
  await logActivity({
    project: projectId,
    actor: actorId,
    action: 'task.bulk_deleted',
    metadata: { count: result.deletedCount, taskIds },
  });
  return { deleted: result.deletedCount };
}

async function notifyAssignees(projectId: string, actorId: string, task: TaskDoc) {
  if (!task.assignees || task.assignees.length === 0) return;
  const project = await Project.findById(projectId).select('name').lean();
  const docs = task.assignees
    .filter((id) => String(id) !== actorId)
    .map((userId) => ({
      user: userId,
      kind: 'task.assigned' as const,
      project: task.project,
      task: task._id,
      actor: new Types.ObjectId(actorId),
      message: `You were assigned to "${task.title}" in ${project?.name ?? 'a project'}`,
    }));
  if (docs.length) await Notification.insertMany(docs);
}

export function invalidateProjectTaskCache(projectId: string) {
  invalidateTaskCache(projectId);
}

import { z } from 'zod';
import { objectId } from './project';

const statusEnum = z.enum(['todo', 'in_progress', 'review', 'completed']);
const priorityEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assignees: z.array(objectId).max(20).optional(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assignees: z.array(objectId).max(20).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  /**
   * Optimistic concurrency: client passes the version it last saw. Server compares
   * before applying — if mismatched, returns 409 so the client can refetch.
   */
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const taskIdParam = z.object({
  projectId: objectId,
  taskId: objectId,
});

export const taskListQuery = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assignee: objectId.optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'priority', '-priority', 'dueDate', '-dueDate']).default('-updatedAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const bulkUpdateSchema = z.object({
  taskIds: z.array(objectId).min(1).max(100),
  patch: z.object({
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    assignees: z.array(objectId).max(20).optional(),
  }).refine((p) => Object.keys(p).length > 0, 'Patch must include at least one field'),
});

export const bulkDeleteSchema = z.object({
  taskIds: z.array(objectId).min(1).max(100),
});

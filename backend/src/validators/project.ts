import { z } from 'zod';

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const projectIdParam = z.object({
  projectId: objectId,
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10),
});

export const memberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export const memberIdParam = z.object({
  projectId: objectId,
  userId: objectId,
});

export const activityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

export const projectListQuery = z.object({
  status: z.enum(['active', 'archived']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * OpenAPI 3.1 spec, derived from the same Zod schemas the runtime validators use.
 *
 * Single source of truth: editing a Zod schema in `src/validators/*` updates both
 * request validation AND the docs. Schemas are registered once with the global
 * registry, then referenced by `$ref` from path operations.
 */
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth';
import {
  projectCreateSchema,
  projectUpdateSchema,
  inviteSchema,
  acceptInviteSchema,
  memberRoleSchema,
  objectId,
} from '../validators/project';
import {
  taskCreateSchema,
  taskUpdateSchema,
  bulkUpdateSchema,
  bulkDeleteSchema,
} from '../validators/task';
import { env } from '../config/env';

extendZodWithOpenApi(z);
const registry = new OpenAPIRegistry();

// ─── Security ───────────────────────────────────────────────────────────────
const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Access token from /api/auth/login or /api/auth/register',
});

// ─── Common building blocks ────────────────────────────────────────────────
const ErrorBody = registry.register(
  'Error',
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
);

function ok<T extends z.ZodTypeAny>(data: T, meta?: z.ZodTypeAny) {
  const shape: Record<string, z.ZodTypeAny> = {
    success: z.literal(true),
    data,
  };
  if (meta) shape.meta = meta;
  return z.object(shape);
}

const PaginationMeta = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

// ─── Domain DTOs (response shapes) ─────────────────────────────────────────
const UserRef = registry.register(
  'UserRef',
  z.object({
    _id: z.string(),
    name: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().url().optional(),
  }),
);

const PublicUser = registry.register(
  'PublicUser',
  z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().url().optional(),
  }),
);

const ProjectMember = registry.register(
  'ProjectMember',
  z.object({
    user: UserRef,
    role: z.enum(['admin', 'member', 'viewer']),
    joinedAt: z.string().datetime(),
  }),
);

const Project = registry.register(
  'Project',
  z.object({
    _id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    status: z.enum(['active', 'archived']),
    owner: UserRef,
    members: z.array(ProjectMember),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
);

const Attachment = registry.register(
  'Attachment',
  z.object({
    fileId: z.string(),
    url: z.string().url(),
    publicId: z.string(),
    filename: z.string(),
    size: z.number().int(),
    mimeType: z.string(),
    uploadedBy: z.string(),
    uploadedAt: z.string().datetime(),
  }),
);

const Task = registry.register(
  'Task',
  z.object({
    _id: z.string(),
    project: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(['todo', 'in_progress', 'review', 'completed']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    assignees: z.array(UserRef),
    dueDate: z.string().datetime().nullable().optional(),
    attachments: z.array(Attachment),
    createdBy: UserRef,
    updatedBy: z.string().optional(),
    version: z.number().int().openapi({
      description: 'Bumped on every server-side mutation. Pass as expectedVersion to detect concurrent edits.',
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
);

const Activity = registry.register(
  'Activity',
  z.object({
    _id: z.string(),
    project: z.string(),
    actor: UserRef,
    action: z.string().openapi({ example: 'task.status_changed' }),
    target: z.object({ kind: z.string(), id: z.string() }).optional(),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.string().datetime(),
  }),
);

const Notification = registry.register(
  'Notification',
  z.object({
    _id: z.string(),
    kind: z.string(),
    project: z.string().optional(),
    task: z.string().optional(),
    actor: z.string().optional(),
    message: z.string(),
    read: z.boolean(),
    createdAt: z.string().datetime(),
  }),
);

const FileDoc = registry.register(
  'File',
  z.object({
    _id: z.string(),
    project: z.string(),
    task: z.string().optional(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int(),
    url: z.string().url(),
    publicId: z.string(),
    resourceType: z.enum(['image', 'video', 'raw', 'auto']),
    uploadedBy: z.string(),
    createdAt: z.string().datetime(),
  }),
);

const AuthSuccess = z.object({
  user: PublicUser,
  accessToken: z.string().openapi({ description: 'Short-lived JWT (15m). Refresh via /auth/refresh.' }),
});

// ─── Path helpers ──────────────────────────────────────────────────────────
const jsonResponse = (schema: z.ZodTypeAny, description = 'Success') => ({
  description,
  content: { 'application/json': { schema } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ErrorBody } },
});

const projectIdParam = registry.registerParameter(
  'ProjectIdPath',
  z.string().openapi({
    param: { name: 'projectId', in: 'path' },
    example: '6543b2f7d8e4a1f3c5b9a2e1',
  }),
);

const taskIdParam = registry.registerParameter(
  'TaskIdPath',
  z.string().openapi({
    param: { name: 'taskId', in: 'path' },
    example: '6543b2f7d8e4a1f3c5b9a2e2',
  }),
);

const fileIdParam = registry.registerParameter(
  'FileIdPath',
  z.string().openapi({
    param: { name: 'fileId', in: 'path' },
    example: '6543b2f7d8e4a1f3c5b9a2e3',
  }),
);

const userIdParam = registry.registerParameter(
  'UserIdPath',
  z.string().openapi({
    param: { name: 'userId', in: 'path' },
    example: '6543b2f7d8e4a1f3c5b9a2e4',
  }),
);

// ─── Auth routes ───────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post', path: '/api/auth/register', tags: ['Auth'],
  summary: 'Register a new account',
  description: 'Creates a user, returns an access token, and sets the `sync_rt` refresh cookie.',
  request: { body: { content: { 'application/json': { schema: registerSchema } } } },
  responses: {
    201: jsonResponse(ok(AuthSuccess), 'Account created'),
    409: errorResponse('Email already registered'),
    422: errorResponse('Validation error'),
    429: errorResponse('Rate limited'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/auth/login', tags: ['Auth'],
  summary: 'Log in with email + password',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: {
    200: jsonResponse(ok(AuthSuccess)),
    401: errorResponse('Invalid credentials'),
    422: errorResponse('Validation error'),
    429: errorResponse('Rate limited'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/auth/refresh', tags: ['Auth'],
  summary: 'Rotate the refresh cookie + return a new access token',
  description: 'Reads the `sync_rt` HttpOnly cookie. Detects token reuse and revokes the whole session family.',
  responses: {
    200: jsonResponse(ok(z.object({ accessToken: z.string() }))),
    401: errorResponse('Missing or invalid refresh token'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/auth/logout', tags: ['Auth'],
  summary: 'Revoke the current refresh token + clear the cookie',
  responses: { 204: { description: 'Logged out' } },
});

registry.registerPath({
  method: 'post', path: '/api/auth/forgot-password', tags: ['Auth'],
  summary: 'Send a password-reset email',
  description: 'Always responds 200 to avoid leaking which emails exist.',
  request: { body: { content: { 'application/json': { schema: forgotPasswordSchema } } } },
  responses: {
    200: jsonResponse(ok(z.object({ sent: z.literal(true) }))),
    429: errorResponse('Rate limited'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/auth/reset-password', tags: ['Auth'],
  summary: 'Reset password using the emailed token',
  description: 'Also revokes every existing refresh token for the user.',
  request: { body: { content: { 'application/json': { schema: resetPasswordSchema } } } },
  responses: {
    200: jsonResponse(ok(z.object({ reset: z.literal(true) }))),
    400: errorResponse('Token invalid or expired'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/auth/me', tags: ['Auth'],
  summary: 'Current user profile',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: jsonResponse(ok(PublicUser)),
    401: errorResponse('Unauthorized'),
  },
});

// ─── Projects ──────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/projects', tags: ['Projects'],
  summary: 'List my projects (paginated)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    query: z.object({
      status: z.enum(['active', 'archived']).optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(50).default(20),
    }),
  },
  responses: {
    200: jsonResponse(ok(z.array(Project), PaginationMeta)),
    401: errorResponse('Unauthorized'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/projects', tags: ['Projects'],
  summary: 'Create a project (caller becomes admin & owner)',
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: projectCreateSchema } } } },
  responses: {
    201: jsonResponse(ok(Project)),
    422: errorResponse('Validation error'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/projects/{projectId}', tags: ['Projects'],
  summary: 'Project detail',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ projectId: projectIdParam }) },
  responses: {
    200: jsonResponse(ok(Project)),
    403: errorResponse('Not a member of this project'),
    404: errorResponse('Project not found'),
  },
});

registry.registerPath({
  method: 'patch', path: '/api/projects/{projectId}', tags: ['Projects'],
  summary: 'Update project (admin only)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    body: { content: { 'application/json': { schema: projectUpdateSchema } } },
  },
  responses: {
    200: jsonResponse(ok(Project)),
    403: errorResponse('Admin required'),
  },
});

registry.registerPath({
  method: 'delete', path: '/api/projects/{projectId}', tags: ['Projects'],
  summary: 'Delete project (owner only, cascades)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ projectId: projectIdParam }) },
  responses: {
    204: { description: 'Deleted' },
    403: errorResponse('Owner only'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/projects/{projectId}/invites', tags: ['Projects'],
  summary: 'Invite a teammate by email',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    body: { content: { 'application/json': { schema: inviteSchema } } },
  },
  responses: {
    201: jsonResponse(ok(z.object({ sent: z.boolean(), expiresAt: z.string().datetime() }))),
    403: errorResponse('Admin required'),
    409: errorResponse('Already a member'),
  },
});

registry.registerPath({
  method: 'post', path: '/api/projects/accept-invite', tags: ['Projects'],
  summary: 'Accept a project invitation',
  security: [{ [bearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: acceptInviteSchema } } } },
  responses: {
    200: jsonResponse(ok(z.object({ projectId: z.string() }))),
    400: errorResponse('Invalid or expired invitation'),
    403: errorResponse('Invitation sent to a different email'),
  },
});

registry.registerPath({
  method: 'patch', path: '/api/projects/{projectId}/members/{userId}', tags: ['Projects'],
  summary: "Change a member's role (admin only)",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam, userId: userIdParam }),
    body: { content: { 'application/json': { schema: memberRoleSchema } } },
  },
  responses: {
    200: jsonResponse(ok(Project)),
    400: errorResponse("Cannot change owner's role"),
  },
});

registry.registerPath({
  method: 'delete', path: '/api/projects/{projectId}/members/{userId}', tags: ['Projects'],
  summary: 'Remove a member (admin only)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ projectId: projectIdParam, userId: userIdParam }) },
  responses: {
    200: jsonResponse(ok(Project)),
    400: errorResponse('Cannot remove owner'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/projects/{projectId}/activity', tags: ['Projects'],
  summary: 'Project activity feed (cursor-paginated)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    query: z.object({
      limit: z.number().int().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }),
  },
  responses: {
    200: jsonResponse(ok(z.array(Activity), z.object({ nextCursor: z.string().nullable() }))),
  },
});

// ─── Tasks ─────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/projects/{projectId}/tasks', tags: ['Tasks'],
  summary: 'List tasks (filter / sort / search / paginate)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    query: z.object({
      status: z.enum(['todo', 'in_progress', 'review', 'completed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      assignee: objectId.optional(),
      search: z.string().optional(),
      sort: z.enum(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'priority', '-priority', 'dueDate', '-dueDate']).default('-updatedAt'),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(25),
    }),
  },
  responses: { 200: jsonResponse(ok(z.array(Task), PaginationMeta)) },
});

registry.registerPath({
  method: 'post', path: '/api/projects/{projectId}/tasks', tags: ['Tasks'],
  summary: 'Create a task (member or higher)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    body: { content: { 'application/json': { schema: taskCreateSchema } } },
  },
  responses: { 201: jsonResponse(ok(Task)) },
});

registry.registerPath({
  method: 'get', path: '/api/projects/{projectId}/tasks/{taskId}', tags: ['Tasks'],
  summary: 'Task detail',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ projectId: projectIdParam, taskId: taskIdParam }) },
  responses: { 200: jsonResponse(ok(Task)), 404: errorResponse('Not found') },
});

registry.registerPath({
  method: 'patch', path: '/api/projects/{projectId}/tasks/{taskId}', tags: ['Tasks'],
  summary: 'Update task (optimistic concurrency)',
  description: 'Pass `expectedVersion` to detect concurrent edits. On mismatch, returns `409 VERSION_CONFLICT` — refetch and retry.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam, taskId: taskIdParam }),
    body: { content: { 'application/json': { schema: taskUpdateSchema } } },
  },
  responses: {
    200: jsonResponse(ok(Task)),
    409: errorResponse('Version conflict — task was modified by someone else'),
  },
});

registry.registerPath({
  method: 'delete', path: '/api/projects/{projectId}/tasks/{taskId}', tags: ['Tasks'],
  summary: 'Delete task (admin only)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ projectId: projectIdParam, taskId: taskIdParam }) },
  responses: { 204: { description: 'Deleted' } },
});

registry.registerPath({
  method: 'post', path: '/api/projects/{projectId}/tasks/bulk-update', tags: ['Tasks'],
  summary: 'Bulk-update task status / priority / assignees',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    body: { content: { 'application/json': { schema: bulkUpdateSchema } } },
  },
  responses: {
    200: jsonResponse(ok(z.object({ matched: z.number().int(), modified: z.number().int() }))),
  },
});

registry.registerPath({
  method: 'post', path: '/api/projects/{projectId}/tasks/bulk-delete', tags: ['Tasks'],
  summary: 'Bulk-delete tasks (admin only)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    body: { content: { 'application/json': { schema: bulkDeleteSchema } } },
  },
  responses: {
    200: jsonResponse(ok(z.object({ deleted: z.number().int() }))),
  },
});

// ─── Files ─────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/projects/{projectId}/files', tags: ['Files'],
  summary: 'List files in a project (optionally for a single task)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    query: z.object({ taskId: objectId.optional() }),
  },
  responses: { 200: jsonResponse(ok(z.array(FileDoc))) },
});

registry.registerPath({
  method: 'post', path: '/api/projects/{projectId}/files', tags: ['Files'],
  summary: 'Upload a file (≤5MB, restricted MIME types)',
  description: 'Streams to Cloudinary. Pass `taskId` to attach to a task.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: z.object({ projectId: projectIdParam }),
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.string().openapi({ type: 'string', format: 'binary' }),
            taskId: objectId.optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: jsonResponse(ok(FileDoc)),
    400: errorResponse('Unsupported file type or too large'),
  },
});

registry.registerPath({
  method: 'get', path: '/api/projects/{projectId}/files/{fileId}/download', tags: ['Files'],
  summary: 'Download a file (302 to short-lived signed URL)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ projectId: projectIdParam, fileId: fileIdParam }) },
  responses: { 302: { description: 'Redirect to a signed Cloudinary URL' } },
});

registry.registerPath({
  method: 'delete', path: '/api/projects/{projectId}/files/{fileId}', tags: ['Files'],
  summary: 'Delete a file (uploader or admin)',
  security: [{ [bearerAuth.name]: [] }],
  request: { params: z.object({ projectId: projectIdParam, fileId: fileIdParam }) },
  responses: {
    204: { description: 'Deleted' },
    403: errorResponse('Not your file'),
  },
});

// ─── Notifications ─────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/notifications', tags: ['Notifications'],
  summary: 'My recent notifications',
  security: [{ [bearerAuth.name]: [] }],
  request: { query: z.object({ limit: z.number().int().min(1).max(100).default(30) }) },
  responses: {
    200: jsonResponse(ok(z.array(Notification), z.object({ unread: z.number().int() }))),
  },
});

registry.registerPath({
  method: 'post', path: '/api/notifications/mark-read', tags: ['Notifications'],
  summary: 'Mark notifications as read (empty `ids` = mark all)',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({ ids: z.array(z.string()).optional() }),
        },
      },
    },
  },
  responses: { 204: { description: 'Marked' } },
});

// ─── Build the document ────────────────────────────────────────────────────
let cached: ReturnType<OpenApiGeneratorV31['generateDocument']> | null = null;

export function getOpenApiSpec() {
  if (cached) return cached;
  const generator = new OpenApiGeneratorV31(registry.definitions);
  cached = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'SYNC API',
      version: '1.0.0',
      description: [
        'Real-time collaborative project management API.',
        '',
        '**Auth flow** — register or log in, then use the returned `accessToken` as a Bearer token here.',
        'The `sync_rt` refresh cookie is set automatically; calling `/auth/refresh` rotates it.',
        '',
        'See [docs/ARCHITECTURE.md](https://github.com/) and [docs/API.md](https://github.com/) for the full design notes.',
      ].join('\n'),
    },
    servers: [
      { url: env.APP_URL, description: env.isProd ? 'Production' : 'Local dev' },
    ],
    tags: [
      { name: 'Auth' },
      { name: 'Projects' },
      { name: 'Tasks' },
      { name: 'Files' },
      { name: 'Notifications' },
    ],
  });
  return cached;
}

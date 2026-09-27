import { asyncHandler } from '../utils/asyncHandler';
import { created, noContent, ok } from '../utils/apiResponse';
import {
  acceptInvitation,
  changeMemberRole,
  createProject,
  deleteProject,
  getProjectById,
  inviteMember,
  listProjectsForUser,
  removeMember,
  updateProject,
} from '../services/projectService';
import { listActivity } from '../services/activityService';
import { NotFoundError, UnauthorizedError } from '../utils/errors';
import { emitToProject } from '../sockets/emit';

export const list = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const { status, search, page, limit } = req.query as any;

  const result = await listProjectsForUser({
    userId: req.user.id,
    status,
    search,
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
  const project = await getProjectById(req.projectId!);
  return ok(res, project);
});

export const create = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const project = await createProject(req.user.id, req.body);
  return created(res, project.toJSON());
});

export const update = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const project = await updateProject(req.projectId!, req.user.id, req.body);

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  emitToProject(req.projectId!, 'project:updated', {
    project: project.toJSON(),
  });

  return ok(res, project.toJSON());
});

export const remove = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  await deleteProject(req.projectId!, req.user.id);

  emitToProject(req.projectId!, 'project:deleted', {
    projectId: req.projectId,
  });

  return noContent(res);
});

export const invite = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const { email, role } = req.body;
  const result = await inviteMember(req.projectId!, req.user.id, email, role);

  return created(res, {
    sent: true,
    expiresAt: result.expiresAt,
  });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const project = await acceptInvitation(req.body.token, req.user.id);

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  emitToProject(String(project._id), 'project:member_added', {
    userId: req.user.id,
  });

  return ok(res, {
    projectId: String(project._id),
  });
});

export const setMemberRole = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const project = await changeMemberRole(
    req.projectId!,
    req.user.id,
    req.params.userId,
    req.body.role,
  );

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  emitToProject(req.projectId!, 'project:member_role_changed', {
    userId: req.params.userId,
    role: req.body.role,
  });

  return ok(res, project.toJSON());
});

export const removeMemberCtrl = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();

  const project = await removeMember(
    req.projectId!,
    req.user.id,
    req.params.userId,
  );

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  emitToProject(req.projectId!, 'project:member_removed', {
    userId: req.params.userId,
  });

  return ok(res, project.toJSON());
});

export const activityFeed = asyncHandler(async (req, res) => {
  const { limit, cursor } = req.query as any;

  const result = await listActivity(req.projectId!, limit, cursor);

  return ok(res, result.items, {
    nextCursor: result.nextCursor,
  });
});
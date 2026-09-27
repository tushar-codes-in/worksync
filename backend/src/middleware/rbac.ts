import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { Project, type ProjectRole } from '../models/Project';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errors';

// Lowest → highest privilege.
const RANK: Record<ProjectRole, number> = { viewer: 0, member: 1, admin: 2 };

export function rolePermits(role: ProjectRole, required: ProjectRole): boolean {
  return RANK[role] >= RANK[required];
}

/**
 * Resolve the caller's role on the project named in `req.params[paramName]`.
 * Attaches `req.projectRole` and `req.projectId`. Use before any project-scoped controller.
 *
 * `minRole` enforces the minimum privilege (default: 'viewer' — read access).
 */
export const requireProjectRole =
  (minRole: ProjectRole = 'viewer', paramName = 'projectId'): RequestHandler =>
  async (req, _res, next) => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const rawId = req.params[paramName];
      if (!rawId || !Types.ObjectId.isValid(rawId)) throw new BadRequestError('Invalid project id');

      const project = await Project.findById(rawId).select('owner members status').lean();
      if (!project) throw new NotFoundError('Project not found');

      const userId = req.user.id;
      let role: ProjectRole | undefined;
      if (String(project.owner) === userId) {
        role = 'admin';
      } else {
        const m = project.members.find((mm) => String(mm.user) === userId);
        role = m?.role;
      }
      if (!role) throw new ForbiddenError('You are not a member of this project');
      if (!rolePermits(role, minRole)) {
        throw new ForbiddenError(`This action requires ${minRole} role or higher`);
      }
      req.projectRole = role;
      req.projectId = rawId;
      next();
    } catch (err) {
      next(err);
    }
  };

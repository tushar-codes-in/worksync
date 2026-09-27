import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireProjectRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  acceptInviteSchema,
  activityQuery,
  inviteSchema,
  memberRoleSchema,
  projectCreateSchema,
  projectListQuery,
  projectUpdateSchema,
} from '../validators/project';
import * as ctrl from '../controllers/projectController';

const r = Router();

r.use(requireAuth);

r.get('/', validate(projectListQuery, 'query'), ctrl.list);
r.post('/', validate(projectCreateSchema), ctrl.create);
r.post('/accept-invite', validate(acceptInviteSchema), ctrl.acceptInvite);

r.get('/:projectId', requireProjectRole('viewer'), ctrl.detail);
r.patch('/:projectId', requireProjectRole('admin'), validate(projectUpdateSchema), ctrl.update);
r.delete('/:projectId', requireProjectRole('admin'), ctrl.remove);

r.post('/:projectId/invites', requireProjectRole('admin'), validate(inviteSchema), ctrl.invite);

r.patch(
  '/:projectId/members/:userId',
  requireProjectRole('admin'),
  validate(memberRoleSchema),
  ctrl.setMemberRole,
);
r.delete('/:projectId/members/:userId', requireProjectRole('admin'), ctrl.removeMemberCtrl);

r.get('/:projectId/activity', requireProjectRole('viewer'), validate(activityQuery, 'query'), ctrl.activityFeed);

export const projectsRouter = r;

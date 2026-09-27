import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireProjectRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as ctrl from '../controllers/taskController';
import {
  bulkDeleteSchema,
  bulkUpdateSchema,
  taskCreateSchema,
  taskListQuery,
  taskUpdateSchema,
} from '../validators/task';

const r = Router({ mergeParams: true });

r.use(requireAuth);

// All task routes are nested under /api/projects/:projectId/tasks
r.get('/', requireProjectRole('viewer'), validate(taskListQuery, 'query'), ctrl.list);
r.post('/', requireProjectRole('member'), validate(taskCreateSchema), ctrl.create);

r.post('/bulk-update', requireProjectRole('member'), validate(bulkUpdateSchema), ctrl.bulkUpdate);
r.post('/bulk-delete', requireProjectRole('admin'), validate(bulkDeleteSchema), ctrl.bulkDelete);

r.get('/:taskId', requireProjectRole('viewer'), ctrl.detail);
r.patch('/:taskId', requireProjectRole('member'), validate(taskUpdateSchema), ctrl.update);
r.delete('/:taskId', requireProjectRole('admin'), ctrl.remove);

r.post('/:taskId/comments', requireProjectRole('member'), ctrl.addComment);

export const tasksRouter = r;
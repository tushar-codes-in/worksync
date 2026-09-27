import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireProjectRole } from '../middleware/rbac';
import { upload as multerUpload } from '../middleware/upload';
import * as ctrl from '../controllers/fileController';

const r = Router({ mergeParams: true });

r.use(requireAuth);

r.get('/', requireProjectRole('viewer'), ctrl.list);
r.post('/', requireProjectRole('member'), multerUpload.single('file'), ctrl.upload);
r.get('/:fileId/download', requireProjectRole('viewer'), ctrl.download);
r.delete('/:fileId', requireProjectRole('member'), ctrl.remove);

export const filesRouter = r;

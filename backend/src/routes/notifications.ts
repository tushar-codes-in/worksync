import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, noContent } from '../utils/apiResponse';
import { Notification } from '../models/Notification';
import { UnauthorizedError } from '../utils/errors';

const r = Router();

r.use(requireAuth);

r.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const items = await Notification.find({ user: new Types.ObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unread = await Notification.countDocuments({ user: new Types.ObjectId(req.user.id), read: false });
    return ok(res, items, { unread });
  }),
);

r.post(
  '/mark-read',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const filter: Record<string, unknown> = { user: new Types.ObjectId(req.user.id) };
    if (ids.length) filter._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
    await Notification.updateMany(filter, { $set: { read: true } });
    return noContent(res);
  }),
);

export const notificationsRouter = r;

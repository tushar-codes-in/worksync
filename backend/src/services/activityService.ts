import { Types } from 'mongoose';
import { Activity, type ActivityAction } from '../models/Activity';

export interface ActivityInput {
  project: string | Types.ObjectId;
  actor: string | Types.ObjectId;
  action: ActivityAction;
  target?: { kind: 'task' | 'project' | 'user' | 'file'; id: string | Types.ObjectId };
  metadata?: Record<string, unknown>;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  // Fire-and-forget. We catch internally so a logging failure never breaks a write.
  try {
    await Activity.create({
      project: new Types.ObjectId(String(input.project)),
      actor: new Types.ObjectId(String(input.actor)),
      action: input.action,
      target: input.target
        ? { kind: input.target.kind, id: new Types.ObjectId(String(input.target.id)) }
        : undefined,
      metadata: input.metadata,
    });
  } catch {
    /* swallow */
  }
}

export async function listActivity(projectId: string, limit: number, cursor?: string) {
  const q: Record<string, unknown> = { project: projectId };
  if (cursor && Types.ObjectId.isValid(cursor)) {
    q._id = { $lt: new Types.ObjectId(cursor) };
  }
  const items = await Activity.find(q)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('actor', 'name email avatarUrl')
    .lean();
  const hasMore = items.length > limit;
  const slice = hasMore ? items.slice(0, limit) : items;
  return {
    items: slice,
    nextCursor: hasMore ? String(slice[slice.length - 1]!._id) : null,
  };
}

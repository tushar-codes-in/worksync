import { Schema, model, type Document, type Types } from 'mongoose';

export type ActivityAction =
  | 'project.created'
  | 'project.updated'
  | 'project.archived'
  | 'project.member_added'
  | 'project.member_removed'
  | 'project.member_role_changed'
  | 'project.invite_sent'
  | 'project.invite_accepted'
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'task.status_changed'
  | 'task.assigned'
  | 'task.attachment_added'
  | 'task.attachment_removed'
  | 'task.bulk_updated'
  | 'task.bulk_deleted';

export interface ActivityDoc extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  actor: Types.ObjectId;
  action: ActivityAction;
  target?: { kind: 'task' | 'project' | 'user' | 'file'; id: Types.ObjectId };
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityDoc>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, index: true },
    target: {
      kind: { type: String, enum: ['task', 'project', 'user', 'file'] },
      id: { type: Schema.Types.ObjectId },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ project: 1, createdAt: -1 });

export const Activity = model<ActivityDoc>('Activity', activitySchema);

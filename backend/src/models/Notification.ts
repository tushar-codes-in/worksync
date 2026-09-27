import { Schema, model, type Document, type Types } from 'mongoose';

export type NotificationKind =
  | 'task.assigned'
  | 'task.status_changed'
  | 'task.mentioned'
  | 'project.invited'
  | 'project.member_added';

export interface NotificationDoc extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  kind: NotificationKind;
  project?: Types.ObjectId;
  task?: Types.ObjectId;
  actor?: Types.ObjectId;
  message: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    task: { type: Schema.Types.ObjectId, ref: 'Task' },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = model<NotificationDoc>('Notification', notificationSchema);

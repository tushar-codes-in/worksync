import { Schema, model, type Document, type Types } from 'mongoose';
import type { ProjectRole } from './Project';

export interface InvitationDoc extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  email: string;
  role: ProjectRole;
  jti: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId;
  revokedAt?: Date;
  createdAt: Date;
}

const invitationSchema = new Schema<InvitationDoc>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], required: true },
    jti: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    revokedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Invitation = model<InvitationDoc>('Invitation', invitationSchema);

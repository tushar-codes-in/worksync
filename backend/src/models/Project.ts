import { Schema, model, type Document, type Types } from 'mongoose';

export type ProjectRole = 'admin' | 'member' | 'viewer';
export type ProjectStatus = 'active' | 'archived';

export interface ProjectMember {
  user: Types.ObjectId;
  role: ProjectRole;
  joinedAt: Date;
}

export interface ProjectDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  status: ProjectStatus;
  owner: Types.ObjectId;
  members: ProjectMember[];
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<ProjectMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], required: true },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const projectSchema = new Schema<ProjectDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 2000 },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

// Fast lookups for "projects I'm a member of".
projectSchema.index({ 'members.user': 1, status: 1, updatedAt: -1 });

export const Project = model<ProjectDoc>('Project', projectSchema);

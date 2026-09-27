import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Project, type ProjectDoc, type ProjectRole } from '../models/Project';
import { User } from '../models/User';
import { Invitation } from '../models/Invitation';
import { Task } from '../models/Task';
import { File as FileModel } from '../models/File';
import { Activity } from '../models/Activity';
import { logActivity } from './activityService';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { signToken, verifyToken, type InvitePayload } from '../utils/jwt';
import { invitationEmail, sendEmail } from './emailService';
import { env } from '../config/env';
import { memoryCache, cacheKey } from '../cache/memoryCache';

const PROJECT_LIST_TTL = 30;

interface ListOpts {
  userId: string;
  status?: 'active' | 'archived';
  search?: string;
  page: number;
  limit: number;
}

export async function listProjectsForUser(opts: ListOpts) {
  const key = cacheKey('projects', opts.userId, opts.status ?? '', opts.search ?? '', opts.page, opts.limit);
  const cached = memoryCache.get<{ items: unknown[]; total: number }>(key);
  if (cached) return cached;

  const uid = new Types.ObjectId(opts.userId);
  const filter: Record<string, unknown> = {
    $or: [{ owner: uid }, { 'members.user': uid }],
  };
  if (opts.status) filter.status = opts.status;
  if (opts.search) filter.name = { $regex: opts.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Project.find(filter)
      .sort({ updatedAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .populate('owner', 'name email avatarUrl')
      .populate('members.user', 'name email avatarUrl')
      .lean(),
    Project.countDocuments(filter),
  ]);

  const result = { items, total };
  memoryCache.set(key, result, PROJECT_LIST_TTL);
  return result;
}

export function invalidateUserProjectCache(userId: string) {
  memoryCache.invalidatePrefix(`projects:${userId}`);
}

export async function getProjectById(projectId: string) {
  const project = await Project.findById(projectId)
    .populate('owner', 'name email avatarUrl')
    .populate('members.user', 'name email avatarUrl')
    .lean();
  if (!project) throw new NotFoundError('Project not found');
  return project;
}

export async function createProject(userId: string, input: { name: string; description?: string }): Promise<ProjectDoc> {
  const project = await Project.create({
    name: input.name,
    description: input.description,
    owner: new Types.ObjectId(userId),
    members: [{ user: new Types.ObjectId(userId), role: 'admin', joinedAt: new Date() }],
    status: 'active',
  });
  invalidateUserProjectCache(userId);
  await logActivity({
    project: project._id,
    actor: userId,
    action: 'project.created',
    target: { kind: 'project', id: project._id },
    metadata: { name: project.name },
  });
  return project;
}

export async function updateProject(
  projectId: string,
  userId: string,
  patch: Partial<{ name: string; description: string; status: 'active' | 'archived' }>,
) {
  const project = await Project.findByIdAndUpdate(projectId, patch, {
    new: true,
    runValidators: true,
  })
    .populate('owner', 'name email avatarUrl')
    .populate('members.user', 'name email avatarUrl');

  if (!project) throw new NotFoundError('Project not found');

  invalidateUserProjectCache(userId);

  await logActivity({
    project: project._id,
    actor: userId,
    action: patch.status === 'archived' ? 'project.archived' : 'project.updated',
    target: { kind: 'project', id: project._id },
    metadata: patch,
  });

  return project;
}

export async function deleteProject(projectId: string, userId: string) {
  const project = await Project.findById(projectId);
  if (!project) throw new NotFoundError('Project not found');
  if (String(project.owner) !== userId) throw new ForbiddenError('Only the owner can delete a project');

  // Cascade. In a larger app this would also delete Cloudinary objects via a queue.
  await Promise.all([
    Task.deleteMany({ project: project._id }),
    FileModel.deleteMany({ project: project._id }),
    Activity.deleteMany({ project: project._id }),
    Invitation.deleteMany({ project: project._id }),
  ]);
  await project.deleteOne();
  invalidateUserProjectCache(userId);
}

export async function inviteMember(projectId: string, inviterId: string, email: string, role: ProjectRole) {
  const project = await Project.findById(projectId).populate('owner', 'name');
  if (!project) throw new NotFoundError('Project not found');

  const existing = await User.findOne({ email });
  if (existing) {
    const already = String(project.owner._id) === String(existing._id) ||
      project.members.some((m) => String(m.user) === String(existing._id));
    if (already) throw new ConflictError('User is already a member of this project');
  }

  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // mirror INVITE TTL default
  const token = signToken<InvitePayload>('invite', {
    projectId,
    email,
    role,
    type: 'invite',
    jti,
  });

  await Invitation.create({
    project: project._id,
    email,
    role,
    jti,
    invitedBy: inviterId,
    expiresAt,
  });

  const inviter = await User.findById(inviterId).lean();
  const inviteUrl = `${env.FRONTEND_URL}/invitations/accept?token=${encodeURIComponent(token)}`;
  const { subject, html } = invitationEmail({
    inviteUrl,
    projectName: project.name,
    inviterName: inviter?.name || 'A teammate',
    role,
  });
  await sendEmail({ to: email, subject, html });

  await logActivity({
    project: project._id,
    actor: inviterId,
    action: 'project.invite_sent',
    metadata: { email, role },
  });

  return { token, expiresAt };
}

export async function acceptInvitation(rawToken: string, userId: string) {
  let payload: InvitePayload;
  try {
    payload = verifyToken<InvitePayload>('invite', rawToken);
  } catch {
    throw new BadRequestError('Invitation is invalid or has expired');
  }

  const invite = await Invitation.findOne({ jti: payload.jti });
  if (!invite) throw new NotFoundError('Invitation not found');
  if (invite.revokedAt) throw new BadRequestError('Invitation has been revoked');
  if (invite.acceptedAt) throw new ConflictError('Invitation has already been accepted');

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.email !== payload.email) {
    throw new ForbiddenError('This invitation was sent to a different email address');
  }

  const project = await Project.findById(payload.projectId);
  if (!project) throw new NotFoundError('Project no longer exists');

  const already = String(project.owner) === userId ||
    project.members.some((m) => String(m.user) === userId);
  if (already) {
    invite.acceptedAt = new Date();
    invite.acceptedBy = user._id;
    await invite.save();
    return project;
  }

  project.members.push({ user: user._id, role: payload.role, joinedAt: new Date() });
  await project.save();

  invite.acceptedAt = new Date();
  invite.acceptedBy = user._id;
  await invite.save();

  invalidateUserProjectCache(userId);
  await logActivity({
    project: project._id,
    actor: userId,
    action: 'project.invite_accepted',
    target: { kind: 'user', id: user._id },
    metadata: { role: payload.role },
  });

  return project;
}

export async function changeMemberRole(projectId: string, actorId: string, targetUserId: string, role: ProjectRole) {
  const project = await Project.findById(projectId);
  if (!project) throw new NotFoundError('Project not found');

  if (String(project.owner) === targetUserId) {
    throw new BadRequestError("Cannot change the owner's role");
  }

  const member = project.members.find((m) => String(m.user) === targetUserId);
  if (!member) throw new NotFoundError('User is not a member of this project');

  member.role = role;
  await project.save();

  invalidateUserProjectCache(targetUserId);

  await logActivity({
    project: project._id,
    actor: actorId,
    action: 'project.member_role_changed',
    target: { kind: 'user', id: targetUserId },
    metadata: { role },
  });

  return Project.findById(projectId)
    .populate('owner', 'name email avatarUrl')
    .populate('members.user', 'name email avatarUrl');
}

export async function removeMember(projectId: string, actorId: string, targetUserId: string) {
  const project = await Project.findById(projectId);
  if (!project) throw new NotFoundError('Project not found');

  if (String(project.owner) === targetUserId) {
    throw new BadRequestError('Cannot remove the project owner');
  }

  const before = project.members.length;
  project.members = project.members.filter((m) => String(m.user) !== targetUserId);

  if (project.members.length === before) {
    throw new NotFoundError('User is not a member of this project');
  }

  await project.save();

  invalidateUserProjectCache(targetUserId);

  await logActivity({
    project: project._id,
    actor: actorId,
    action: 'project.member_removed',
    target: { kind: 'user', id: targetUserId },
  });

  return Project.findById(projectId)
    .populate('owner', 'name email avatarUrl')
    .populate('members.user', 'name email avatarUrl');
}
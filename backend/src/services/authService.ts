import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { User, type UserDoc } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { signToken, verifyToken, type AccessPayload, type RefreshPayload, type ResetPayload } from '../utils/jwt';
import { parseDurationMs } from '../utils/ms';
import { env } from '../config/env';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { passwordResetEmail, sendEmail } from './emailService';
import type { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from '../validators/auth';

export interface SessionContext {
  userAgent?: string;
  ip?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export async function registerUser(input: RegisterInput, ctx: SessionContext): Promise<{ user: UserDoc; tokens: AuthTokens }> {
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await User.hashPassword(input.password);
  const user = await User.create({ name: input.name, email: input.email, passwordHash });
  const tokens = await issueTokens(user, ctx);
  return { user, tokens };
}

export async function loginUser(input: LoginInput, ctx: SessionContext): Promise<{ user: UserDoc; tokens: AuthTokens }> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  if (!user) throw new UnauthorizedError('Invalid email or password');
  const ok = await user.comparePassword(input.password);
  if (!ok) throw new UnauthorizedError('Invalid email or password');
  const tokens = await issueTokens(user, ctx);
  return { user, tokens };
}

export async function issueTokens(user: UserDoc, ctx: SessionContext): Promise<AuthTokens> {
  const jti = randomUUID();
  const refreshToken = signToken<RefreshPayload>('refresh', { sub: user.id, jti, type: 'refresh' });
  const accessToken = signToken<AccessPayload>('access', { sub: user.id, email: user.email, type: 'access' });
  const expiresAt = new Date(Date.now() + parseDurationMs(env.REFRESH_TOKEN_TTL));

  const tokenHash = await bcrypt.hash(refreshToken, 10);
  await RefreshToken.create({
    user: user._id,
    jti,
    tokenHash,
    userAgent: ctx.userAgent,
    ip: ctx.ip,
    expiresAt,
  });

  return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
}

/**
 * Rotate refresh token. If a previously-revoked token is presented, revoke the entire family
 * (a sign of token theft).
 */
export async function rotateRefreshToken(rawToken: string, ctx: SessionContext): Promise<AuthTokens> {
  let payload: RefreshPayload;
  try {
    payload = verifyToken<RefreshPayload>('refresh', rawToken);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
  if (payload.type !== 'refresh') throw new UnauthorizedError('Invalid token type');

  const stored = await RefreshToken.findOne({ jti: payload.jti });
  if (!stored) throw new UnauthorizedError('Refresh token not recognized');

  // Token reuse detection: previously revoked token presented → revoke entire family.
  if (stored.revokedAt) {
    await RefreshToken.updateMany({ user: stored.user, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    throw new UnauthorizedError('Refresh token reuse detected — session terminated');
  }

  const hashOk = await bcrypt.compare(rawToken, stored.tokenHash);
  if (!hashOk) throw new UnauthorizedError('Refresh token mismatch');

  const user = await User.findById(stored.user);
  if (!user) throw new UnauthorizedError('User no longer exists');

  const tokens = await issueTokens(user, ctx);
  stored.revokedAt = new Date();
  // We don't know the new jti before issueTokens runs — set it post hoc.
  stored.replacedByJti = (verifyToken<RefreshPayload>('refresh', tokens.refreshToken)).jti;
  await stored.save();

  return tokens;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  try {
    const payload = verifyToken<RefreshPayload>('refresh', rawToken);
    await RefreshToken.updateOne({ jti: payload.jti }, { $set: { revokedAt: new Date() } });
  } catch {
    // swallow — logout should be idempotent
  }
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const user = await User.findOne({ email: input.email });
  // Always succeed to avoid leaking which emails are registered.
  if (!user) return;

  const token = signToken<ResetPayload>('reset', { sub: user.id, type: 'reset' });
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const { subject, html } = passwordResetEmail(resetUrl, user.name);
  await sendEmail({ to: user.email, subject, html });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  let payload: ResetPayload;
  try {
    payload = verifyToken<ResetPayload>('reset', input.token);
  } catch {
    throw new BadRequestError('Reset link is invalid or has expired');
  }
  if (payload.type !== 'reset') throw new BadRequestError('Invalid reset token');

  const user = await User.findById(payload.sub);
  if (!user) throw new NotFoundError('Account not found');

  user.passwordHash = await User.hashPassword(input.password);
  await user.save();

  // Security hygiene: invalidate all existing refresh tokens after password change.
  await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type TokenKind = 'access' | 'refresh' | 'reset' | 'invite';

const SECRETS: Record<TokenKind, Secret> = {
  access: env.JWT_ACCESS_SECRET,
  refresh: env.JWT_REFRESH_SECRET,
  reset: env.JWT_RESET_SECRET,
  invite: env.JWT_INVITE_SECRET,
};

const TTLS: Record<TokenKind, string> = {
  access: env.ACCESS_TOKEN_TTL,
  refresh: env.REFRESH_TOKEN_TTL,
  reset: env.RESET_TOKEN_TTL,
  invite: env.INVITE_TOKEN_TTL,
};

export interface AccessPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export interface ResetPayload {
  sub: string;
  type: 'reset';
}

export interface InvitePayload {
  projectId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  type: 'invite';
  jti: string;
}

export function signToken<T extends object>(
  kind: TokenKind,
  payload: T,
  opts: SignOptions = {},
): string {
  return jwt.sign(payload as object, SECRETS[kind], {
    expiresIn: TTLS[kind] as SignOptions['expiresIn'],
    ...opts,
  });
}

export function verifyToken<T = unknown>(kind: TokenKind, token: string): T {
  return jwt.verify(token, SECRETS[kind]) as T;
}

import type { CookieOptions, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { created, noContent, ok } from '../utils/apiResponse';
import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../services/authService';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { User } from '../models/User';

const REFRESH_COOKIE = 'sync_rt';

function cookieOpts(expires?: Date): CookieOptions {
  const secure = env.COOKIE_SECURE || env.isProd;
  // Auto-pick SameSite unless explicitly overridden: `none` for cross-origin
  // (Vercel + Render), `lax` for same-origin (Vercel single-deploy) or local dev.
  const sameSite: CookieOptions['sameSite'] =
    env.COOKIE_SAMESITE ?? (secure ? 'none' : 'lax');
  return {
    httpOnly: true,
    secure,
    sameSite,
    domain: env.COOKIE_DOMAIN || undefined,
    path: env.COOKIE_PATH,
    ...(expires ? { expires } : {}),
  };
}

// Boot-time diagnostic — logged once so a misconfigured cookie path is
// immediately visible in Vercel/Render logs without needing to repro a login.
import { logger as _bootLogger } from '../config/logger';
const _bootSecure = env.COOKIE_SECURE || env.isProd;
_bootLogger.info(
  {
    cookieName: REFRESH_COOKIE,
    path: env.COOKIE_PATH,
    sameSite: env.COOKIE_SAMESITE ?? (_bootSecure ? 'none' : 'lax'),
    secure: _bootSecure,
    domain: env.COOKIE_DOMAIN || '(none)',
  },
  'Refresh cookie config',
);

function setRefreshCookie(res: Response, refreshToken: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts(expires));
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieOpts());
}

function context(req: Request) {
  return {
    userAgent: req.headers['user-agent'] as string | undefined,
    ip: req.ip,
  };
}

export const register = asyncHandler(async (req, res) => {
  const { user, tokens } = await registerUser(req.body, context(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  return created(res, {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken: tokens.accessToken,
  });
});

export const login = asyncHandler(async (req, res) => {
  const { user, tokens } = await loginUser(req.body, context(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  return ok(res, {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken: tokens.accessToken,
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  if (!raw) throw new UnauthorizedError('Missing refresh token');
  const tokens = await rotateRefreshToken(raw, context(req));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  return ok(res, { accessToken: tokens.accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await revokeRefreshToken(raw);
  clearRefreshCookie(res);
  return noContent(res);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await requestPasswordReset(req.body);
  // Always return 200 to avoid leaking which emails exist.
  return ok(res, { sent: true });
});

export const resetPasswordCtrl = asyncHandler(async (req, res) => {
  await resetPassword(req.body);
  return ok(res, { reset: true });
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new UnauthorizedError();
  const user = await User.findById(req.user.id).lean();
  if (!user) throw new UnauthorizedError();
  return ok(res, { id: String(user._id), email: user.email, name: user.name, avatarUrl: user.avatarUrl });
});
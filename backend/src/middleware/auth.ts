import type { RequestHandler } from 'express';
import { verifyToken, type AccessPayload } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

const BEARER = /^Bearer (.+)$/;

export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const m = header && BEARER.exec(header);
    if (!m) throw new UnauthorizedError('Missing access token');
    const token = m[1];
    const payload = verifyToken<AccessPayload>('access', token);
    if (payload.type !== 'access') throw new UnauthorizedError('Invalid token type');
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    next(err instanceof UnauthorizedError ? err : new UnauthorizedError('Invalid access token'));
  }
};

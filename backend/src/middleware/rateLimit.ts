import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts. Try again later.' } },
  // Skip rate limits in test runs.
  skip: () => env.isTest,
});

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: env.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
  skip: () => env.isTest,
});

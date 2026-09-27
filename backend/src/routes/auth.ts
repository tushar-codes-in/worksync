import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as ctrl from '../controllers/authController';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validators/auth';

const r = Router();

r.post('/register', authLimiter, validate(registerSchema), ctrl.register);
r.post('/login', authLimiter, validate(loginSchema), ctrl.login);
r.post('/refresh', ctrl.refresh);
r.post('/logout', ctrl.logout);
r.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), ctrl.forgotPassword);
r.post('/reset-password', authLimiter, validate(resetPasswordSchema), ctrl.resetPasswordCtrl);
r.get('/me', requireAuth, ctrl.me);

export const authRouter = r;

// Side-effect import: registers our Request type augmentation (req.user, req.projectRole, etc.)
// before any handler is defined. Must precede express imports.
import './types/express';

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDB, ensureDB } from './config/db';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { tasksRouter } from './routes/tasks';
import { filesRouter } from './routes/files';
import { notificationsRouter } from './routes/notifications';
import { buildDocsRouter } from './docs/swagger';
import { initSocket } from './sockets';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
  app.use((req, res, next) => {
    const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host;
    const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const sameOrigin = host ? `${proto}://${host}` : null;

    return cors({
      credentials: true,
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (sameOrigin && origin === sameOrigin) return cb(null, true);
        if (env.CORS_ORIGINS_LIST.includes(origin)) return cb(null, true);

          if (/^https:\/\/sync-main[^.]*\.vercel\.app$/.test(origin)) return cb(null, true);
          
        return cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
    })(req, res, next);
  });
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(globalLimiter);

  app.get('/health', (_req, res) => res.json({ ok: true, env: env.NODE_ENV, time: new Date().toISOString() }));

  // Interactive API docs — Swagger UI at /docs, raw spec at /docs.json (don't need Mongo)
  app.use('/', buildDocsRouter());

  if (!env.isTest) {
    app.use('/api', async (_req, _res, next) => {
      try {
        await ensureDB();
        next();
      } catch (err) {
        next(err);
      }
    });
  }

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:projectId/tasks', tasksRouter);
  app.use('/api/projects/:projectId/files', filesRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/**
 * Runtime singleton — used by both:
 *   - Vercel `experimentalServices` (which imports the default export of this module
 *     and expects a function or http.Server), and
 *   - local `index.ts` (which calls `.listen()` on the server).
 *
 * Tests bypass this and call `createApp()` directly with a fresh app instance.
 */
const app = createApp();
const server = http.createServer(app);
initSocket(server);

// Kick off DB connection. Mongoose buffers commands until connected, so handlers
// running before this resolves will queue rather than fail. Skipped in test mode —
// tests provide their own in-memory Mongo via tests/setup.ts.
if (!env.isTest) {
  connectDB().catch((err) => {
    logger.error({ err }, 'Initial DB connection failed');
  });
}

export default server;
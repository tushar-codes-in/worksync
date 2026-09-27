import './types/express';

import server from './app';
import { env } from './config/env';
import { logger } from './config/logger';

// Local + Render bootstrap.
// On Vercel `experimentalServices`, this file is NOT used — Vercel imports the
// default export of `./app` directly and calls `.listen()` on its own port.
server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'SYNC backend listening');
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

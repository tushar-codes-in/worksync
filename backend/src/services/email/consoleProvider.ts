import { logger } from '../../config/logger';
import type { EmailProvider } from './types';

/**
 * Dev fallback — when no provider is configured, dump emails to the log so password
 * reset and invitation links are still copy-pasteable from `pnpm dev` output.
 */
export const consoleProvider: EmailProvider = {
  name: 'console',
  async send({ to, subject, html }) {
    logger.info({ to, subject, html }, 'Email (console provider — not actually sent)');
  },
};

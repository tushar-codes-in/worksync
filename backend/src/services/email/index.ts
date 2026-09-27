import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { consoleProvider } from './consoleProvider';
import { resendProvider } from './resendProvider';
import { smtpProvider } from './smtpProvider';
import type { EmailProvider } from './types';

export type { MailParams, EmailProvider } from './types';

let active: EmailProvider | null = null;

function pickProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'resend':
      if (!env.RESEND_API_KEY) {
        logger.warn('EMAIL_PROVIDER=resend but RESEND_API_KEY missing — using console provider');
        return consoleProvider;
      }
      return resendProvider;
    case 'smtp':
      if (!env.SMTP_HOST) {
        logger.warn('EMAIL_PROVIDER=smtp but SMTP_HOST missing — using console provider');
        return consoleProvider;
      }
      return smtpProvider;
    case 'console':
    default:
      return consoleProvider;
  }
}

export function getEmail(): EmailProvider {
  if (!active) {
    active = pickProvider();
    logger.info({ provider: active.name }, 'Email provider initialized');
  }
  return active;
}

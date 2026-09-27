import { Resend } from 'resend';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { EmailProvider } from './types';

let client: Resend | null = null;

export const resendProvider: EmailProvider = {
  name: 'resend',
  async send({ to, subject, html, text }) {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
    if (!client) client = new Resend(env.RESEND_API_KEY);
    const { error } = await client.emails.send({ from: env.RESEND_FROM, to, subject, html, text });
    if (error) {
      logger.error({ error, to, subject }, 'Resend send failed');
      throw new Error('Failed to send email');
    }
  },
};

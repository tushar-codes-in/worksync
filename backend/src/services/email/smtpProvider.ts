import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { EmailProvider } from './types';

let transporter: Transporter | null = null;

function getTransport() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    throw new Error('SMTP_HOST and SMTP_PORT must be set for the smtp email provider');
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER && env.SMTP_PASS
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export const smtpProvider: EmailProvider = {
  name: 'smtp',
  async send({ to, subject, html, text }) {
    const t = getTransport();
    const info = await t.sendMail({ from: env.SMTP_FROM, to, subject, html, text });
    logger.debug({ messageId: info.messageId, to }, 'SMTP send ok');
  },
};

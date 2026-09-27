/**
 * Thin façade over the email adapter (`./email`). Owns the template-builders.
 * Provider selection (Resend / SMTP / console) lives in `./email/index.ts` and is
 * driven by `EMAIL_PROVIDER`.
 */
import { env } from '../config/env';
import { getEmail, type MailParams } from './email';

export type { MailParams } from './email';

export async function sendEmail(params: MailParams): Promise<void> {
  await getEmail().send(params);
}

export function passwordResetEmail(resetUrl: string, name: string) {
  return {
    subject: 'Reset your SYNC password',
    html: `
      <div style="font-family: ui-sans-serif, system-ui; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="margin-bottom: 8px;">Reset your password</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>We received a request to reset your SYNC password. Click below to choose a new one. This link expires in ${env.RESET_TOKEN_TTL}.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #111; color: white; padding: 12px 18px; border-radius: 6px; text-decoration: none;">Reset password</a>
        </p>
        <p style="color: #555; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };
}

export function invitationEmail(opts: { inviteUrl: string; projectName: string; inviterName: string; role: string }) {
  return {
    subject: `You've been invited to ${opts.projectName} on SYNC`,
    html: `
      <div style="font-family: ui-sans-serif, system-ui; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2>You're invited</h2>
        <p>${escapeHtml(opts.inviterName)} invited you to join <strong>${escapeHtml(opts.projectName)}</strong> as a <strong>${escapeHtml(opts.role)}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${opts.inviteUrl}" style="background: #111; color: white; padding: 12px 18px; border-radius: 6px; text-decoration: none;">Accept invitation</a>
        </p>
        <p style="color: #555; font-size: 12px;">This link expires in ${env.INVITE_TOKEN_TTL}.</p>
      </div>
    `,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

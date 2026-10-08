/**
 * Mailer: sends the notification emails (loans, transfers, repairs, returns, disposals) through Mailgun.
 * Layer: shared service. Called by remainingRoutes.ts; later by each feature's service. Calls config/env.ts and mailgun.js.
 * Used by: every workflow that notifies a custodian, Lab Head, Staff, or the Director by email.
 */
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { env } from '../../config/env';

const MAILGUN_API_KEY = env.mailgunApiKey;
const MAILGUN_DOMAIN = env.mailgunDomain;
const MAILGUN_FROM = env.mailgunFrom || `AdRIC Asset Management <mailgun@${MAILGUN_DOMAIN}>`;

const mailgun = new Mailgun(formData);
const mg = MAILGUN_API_KEY
    ? mailgun.client({ username: 'api', key: MAILGUN_API_KEY })
    : null;

/**
 * Sends one email, fire and forget. Never throws: a Mailgun outage, missing
 * settings, or a bad recipient logs a warning instead of breaking the API
 * answer the user is waiting on. Call it after a database write has
 * committed (for example after prisma.$transaction resolves), never from
 * inside one: a network call inside a transaction holds its locks open and
 * slows every other request while it waits on Mailgun.
 *
 * @param to one address or several; empty entries are dropped
 * @param subject the subject line
 * @param html the body, usually from emailTemplate
 * @returns when the send was attempted or skipped
 */
export async function sendEmail(to: string | string[], subject: string, html: string): Promise<void> {
    const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);

    if (!mg || !MAILGUN_DOMAIN) {
        console.warn(`✉️  Mailgun not configured — skipping email "${subject}" (would go to: ${recipients.join(', ') || 'nobody'})`);
        return;
    }
    if (recipients.length === 0) {
        console.warn(`✉️  No recipient resolved for email "${subject}" — skipping`);
        return;
    }

    try {
        await mg.messages.create(MAILGUN_DOMAIN, {
            from: MAILGUN_FROM,
            to: recipients,
            subject,
            html,
        });
        console.log(`✉️  Sent "${subject}" to ${recipients.join(', ')}`);
    } catch (err: any) {
        console.error(`❌ Mailgun send failed for "${subject}" to ${recipients.join(', ')}:`, err?.message || err);
    }
}

/**
 * Wraps a notification in the shared AdRIC layout, so every email looks the same.
 *
 * @param heading the title line, inserted as HTML
 * @param bodyHtml the body, inserted as HTML
 * @returns the full HTML for sendEmail
 */
// TODO(H-20): heading and bodyHtml are inserted unescaped, and callers put asset names and typed reasons in them. Escape them (server/shared/utils/html.ts). Step 13.
export function emailTemplate(heading: string, bodyHtml: string): string {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <div style="background:#005A36; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <span style="color:#fff; font-weight:bold; font-size: 16px;">AdRIC Asset Management</span>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <h2 style="margin-top:0; font-size: 18px;">${heading}</h2>
        ${bodyHtml}
      </div>
      <p style="color:#9ca3af; font-size: 11px; margin-top: 12px;">
        This is an automated notification from the DLSU CCS AdRIC Asset Management System. Please do not reply directly to this email.
      </p>
    </div>`;
}
// mailer.ts
// Thin wrapper around Mailgun for transactional notification emails
// (loans, transfers, repairs, returns, disposals).

import formData from 'form-data';
import Mailgun from 'mailgun.js';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const MAILGUN_FROM = process.env.MAILGUN_FROM || `AdRIC Asset Management <mailgun@${MAILGUN_DOMAIN}>`;

const mailgun = new Mailgun(formData);
const mg = MAILGUN_API_KEY
    ? mailgun.client({ username: 'api', key: MAILGUN_API_KEY })
    : null;

/**
 * Fire-and-forget email send. Deliberately never throws — a Mailgun outage,
 * missing config, or bad recipient should log a warning, not break the API
 * response the user is actually waiting on. Call this AFTER a DB write has
 * committed (e.g. after prisma.$transaction resolves), never from inside
 * one — a network call inside a DB transaction holds locks open and slows
 * every other request down while it waits on Mailgun.
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

/** Shared HTML wrapper so every notification looks consistent. */
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
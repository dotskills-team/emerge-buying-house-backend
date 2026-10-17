import type { Mail } from '../../../lib/mailer.js';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetPasswordEmail(input: {
  to: string;
  name: string;
  link: string;
  ttlMinutes: number;
  appName: string;
}): Mail {
  const { to, name, link, ttlMinutes, appName } = input;
  const subject = `Reset your ${appName} password`;
  const text = [
    `Hello ${name},`,
    '',
    `Someone asked to reset the password for your ${appName} account.`,
    `Open this link within ${ttlMinutes} minutes to choose a new password:`,
    link,
    '',
    'If you did not ask for this, you can ignore this email. Your password will not change.',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:32px">
        <tr><td>
          <p style="margin:0 0 16px;font-size:16px">Hello ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569">
            Someone asked to reset the password for your ${escapeHtml(appName)} account.
            This link works once and expires in ${ttlMinutes} minutes.
          </p>
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;font-weight:bold">Choose a new password</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#475569">
            If you did not ask for this, ignore this email. Your password will not change.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { to, subject, html, text };
}

import type { Mail } from '../../../lib/mailer.js';
import { TOPIC_LABELS, type IInquiry } from '../models/inquiry.model.js';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Escaped, with line breaks kept. */
const paragraphs = (value: string) => escapeHtml(value).replace(/\r?\n/g, '<br>');

const dateTime = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(d);

type InquiryFields = Pick<
  IInquiry,
  | 'reference'
  | 'name'
  | 'email'
  | 'company'
  | 'phone'
  | 'country'
  | 'topic'
  | 'product'
  | 'message'
  | 'createdAt'
>;

/** The shared frame: a white card on a light background, in the brand blue. */
function layout(appName: string, body: string, footer: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
        <tr><td style="background:#1d4ed8;border-radius:10px 10px 0 0;padding:18px 28px;color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:.3px">${escapeHtml(appName)}</td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px;padding:28px">${body}</td></tr>
        <tr><td style="padding:16px 8px;font-size:12px;line-height:1.6;color:#64748b;text-align:center">${footer}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function detailsTable(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;font-size:13px;color:#64748b;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 0;font-size:14px;color:#0f172a;word-break:break-word">${value}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 20px">${cells}</table>`;
}

const quoteBlock = (text: string) =>
  `<div style="background:#f8fafc;border-left:3px solid #1d4ed8;border-radius:4px;padding:14px 16px;font-size:14px;line-height:1.65;color:#334155">${paragraphs(text)}</div>`;

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:bold">${escapeHtml(label)}</a>`;

/** To the team: everything needed to answer, and "Reply" goes straight to the visitor. */
export function teamNotificationEmail(input: {
  to: string[];
  inquiry: InquiryFields;
  dashboardUrl: string;
  appName: string;
}): Mail {
  const { inquiry: q, dashboardUrl, appName } = input;
  const topic = TOPIC_LABELS[q.topic];
  const who = q.company ? `${q.name} (${q.company})` : q.name;
  const subject = `New inquiry: ${topic} from ${who} [${q.reference}]`;

  // Plain values; empty optional fields are left out.
  const details = (
    [
      ['Name', q.name],
      ['Email', q.email],
      ['Company', q.company],
      ['Phone', q.phone],
      ['Country', q.country],
      ['Topic', topic],
      ['Product', q.product],
      ['Received', dateTime(q.createdAt)],
    ] as Array<[string, string]>
  ).filter(([, value]) => value);
  const rows = details.map(([label, value]): [string, string] => [
    label,
    label === 'Email'
      ? `<a href="mailto:${escapeHtml(value)}" style="color:#1d4ed8">${escapeHtml(value)}</a>`
      : escapeHtml(value),
  ]);

  const html = layout(
    appName,
    `<p style="margin:0 0 4px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#1d4ed8;text-transform:uppercase">New website inquiry · ${escapeHtml(q.reference)}</p>
     <h1 style="margin:0 0 20px;font-size:20px;line-height:1.3">${escapeHtml(topic)} from ${escapeHtml(who)}</h1>
     ${detailsTable(rows)}
     <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#334155">Message</p>
     ${quoteBlock(q.message)}
     <p style="margin:24px 0 0">${button(dashboardUrl, 'Open in dashboard')}</p>
     <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748b">Replying to this email answers ${escapeHtml(q.name)} directly. Replies sent from the dashboard are also kept with the inquiry.</p>`,
    `Sent by the contact form on the ${escapeHtml(appName)} website.`,
  );

  const text = [
    `New website inquiry ${q.reference}`,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    q.message,
    '',
    `Open in dashboard: ${dashboardUrl}`,
    `Replying to this email answers ${q.name} directly.`,
  ].join('\n');

  return { to: input.to, subject, html, text, replyTo: q.email };
}

/**
 * To the visitor: confirms we have it and gives the reference. It deliberately does not repeat
 * their message, so the form cannot be used to send arbitrary text to someone else's inbox.
 */
export function visitorAcknowledgementEmail(input: {
  inquiry: InquiryFields;
  appName: string;
  replyTo?: string;
}): Mail {
  const { inquiry: q, appName } = input;
  const subject = `We have received your message [${q.reference}]`;
  const html = layout(
    appName,
    `<p style="margin:0 0 16px;font-size:16px">Hello ${escapeHtml(q.name)},</p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155">Thank you for contacting ${escapeHtml(appName)}. Your message has reached our team, and a merchandiser will reply within one working day (Sunday to Thursday, Bangladesh time).</p>
     ${detailsTable([
       ['Reference', `<strong>${escapeHtml(q.reference)}</strong>`],
       ['Topic', escapeHtml(TOPIC_LABELS[q.topic])],
       ['Sent', escapeHtml(dateTime(q.createdAt))],
     ])}
     <p style="margin:0;font-size:14px;line-height:1.65;color:#334155">If you want to add details such as tech packs, quantities or target dates, just reply to this email and keep the reference in the subject.</p>`,
    `You are receiving this because this address was entered in the contact form on the ${escapeHtml(appName)} website. If that was not you, you can ignore this email.`,
  );
  const text = [
    `Hello ${q.name},`,
    '',
    `Thank you for contacting ${appName}. Your message has reached our team, and a merchandiser will reply within one working day (Sunday to Thursday, Bangladesh time).`,
    '',
    `Reference: ${q.reference}`,
    `Topic: ${TOPIC_LABELS[q.topic]}`,
    `Sent: ${dateTime(q.createdAt)}`,
    '',
    'To add details such as tech packs, quantities or target dates, reply to this email and keep the reference in the subject.',
  ].join('\n');
  return { to: q.email, subject, html, text, replyTo: input.replyTo };
}

/** A staff reply written in the dashboard, with the visitor's original message quoted below. */
export function replyEmail(input: {
  inquiry: InquiryFields;
  message: string;
  senderName: string;
  appName: string;
  replyTo?: string;
}): Mail {
  const { inquiry: q, message, senderName, appName } = input;
  const subject = `Re: Your inquiry to ${appName} [${q.reference}]`;
  const html = layout(
    appName,
    `<div style="font-size:15px;line-height:1.7;color:#0f172a">${paragraphs(message)}</div>
     <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#334155">${escapeHtml(senderName)}<br><span style="color:#64748b">${escapeHtml(appName)}</span></p>
     <hr style="border:0;border-top:1px solid #e2e8f0;margin:28px 0 16px">
     <p style="margin:0 0 8px;font-size:12px;color:#64748b">On ${escapeHtml(dateTime(q.createdAt))}, ${escapeHtml(q.name)} wrote:</p>
     ${quoteBlock(q.message)}`,
    `Reference ${escapeHtml(q.reference)}. Reply to this email to continue the conversation.`,
  );
  const text = [
    message,
    '',
    senderName,
    appName,
    '',
    `On ${dateTime(q.createdAt)}, ${q.name} wrote:`,
    ...q.message.split(/\r?\n/).map((l) => `> ${l}`),
  ].join('\n');
  return { to: q.email, subject, html, text, replyTo: input.replyTo };
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  /** False when no provider is configured: callers must not pretend an email was sent. */
  readonly configured: boolean;
  send(mail: Mail): Promise<void>;
}

/** Sends through the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export function createResendMailer(options: { apiKey?: string; from?: string }): Mailer {
  const { apiKey, from } = options;
  return {
    configured: Boolean(apiKey && from),
    async send(mail) {
      if (!apiKey || !from) throw new Error('Email delivery is not configured.');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, ...mail }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        // The response body explains the failure (e.g. unverified domain) and contains no secrets.
        throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
    },
  };
}

import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import { startIntegration, type Integration } from '../../test/integration.js';

let api: Integration;
before(async () => {
  api = await startIntegration();
});
afterEach(() => {
  api.mailer.failWith = null;
});
after(async () => {
  await api.stop();
});

interface InquiryView {
  id: string;
  reference: string;
  name: string;
  email: string;
  status: string;
  note: string;
  notifications: { team: string; visitor: string };
  replies: { message: string; sentBy: { id: string; name: string } | null; sentAt: string }[];
}
interface ListView {
  items: InquiryView[];
  meta: { total: number };
}

const FORM = {
  name: 'Anna Berg',
  email: 'Anna.Berg@Example.com ',
  company: 'Nordic Wear AB',
  phone: '+46 70 123 45 67',
  country: 'Sweden',
  topic: 'quote',
  product: 'Organic jersey tee',
  message: 'We need 5,000 pcs of the jersey tee in three colours by March.',
};

const submit = (body: unknown) =>
  api.call<{ reference: string; confirmationSent: boolean }>('/api/contact', {
    method: 'POST',
    body,
  });

describe('contact form', () => {
  it('stores the message, emails the team and the visitor, and returns a reference', async () => {
    const before = api.mailer.sent.length;
    const res = await submit(FORM);
    assert.equal(res.status, 201);
    assert.match(res.json.data.reference, /^EBH-\d{6}-[2-9A-HJ-NP-Z]{4}$/);
    assert.equal(res.json.data.confirmationSent, true);

    const [team, visitor] = api.mailer.sent.slice(before);
    assert.deepEqual(team?.to, ['sales@example.com', 'owner@example.com']);
    assert.equal(team?.replyTo, 'anna.berg@example.com');
    assert.ok(team?.subject.includes(res.json.data.reference));
    assert.ok(team?.text.includes(FORM.message));
    assert.equal(visitor?.to, 'anna.berg@example.com');
    assert.equal(visitor?.replyTo, 'sales@example.com');
    // The confirmation never repeats the message, so the form cannot relay text to a stranger.
    assert.equal(visitor?.text.includes(FORM.message), false);

    const admin = await api.signIn('admin');
    const list = await api.call<ListView>('/api/inquiries?q=nordic', { token: admin.token });
    const stored = list.json.data.items[0];
    assert.equal(stored?.reference, res.json.data.reference);
    assert.equal(stored?.email, 'anna.berg@example.com');
    assert.equal(stored?.status, 'new');
    assert.deepEqual(stored?.notifications, { team: 'sent', visitor: 'sent' });
  });

  it('escapes visitor input in the HTML emails', async () => {
    const before = api.mailer.sent.length;
    await submit({ ...FORM, name: '<b>Eve</b>', message: '<script>alert(1)</script> hello there' });
    const team = api.mailer.sent[before];
    assert.equal(team?.html.includes('<script>'), false);
    assert.equal(team?.html.includes('<b>Eve</b>'), false);
    assert.ok(team?.html.includes('&#60;script&#62;'));
  });

  it('rejects invalid input with per-field messages', async () => {
    const res = await submit({
      name: 'A',
      email: 'not-an-email',
      phone: 'call me',
      topic: 'spam',
      message: 'short',
    });
    assert.equal(res.status, 400);
    const paths = (res.json as unknown as { errors: { path: string }[] }).errors.map((e) => e.path);
    for (const field of ['name', 'email', 'phone', 'topic', 'message']) {
      assert.ok(paths.includes(field), `expected an error for ${field}`);
    }
    const multiline = await submit({ ...FORM, name: 'Anna\nBcc: x@example.com' });
    assert.equal(multiline.status, 400);
  });

  it('answers bots that fill the honeypot normally, but stores and sends nothing', async () => {
    const admin = await api.signIn('admin');
    const count = async () =>
      (await api.call<ListView>('/api/inquiries', { token: admin.token })).json.data.meta.total;
    const total = await count();
    const sent = api.mailer.sent.length;

    const res = await submit({ ...FORM, website: 'https://spam.example' });
    assert.equal(res.status, 201);
    assert.equal(await count(), total);
    assert.equal(api.mailer.sent.length, sent);
  });

  it('keeps the message when email delivery fails, and records the failure', async () => {
    api.mailer.failWith = new Error('provider down');
    const res = await submit({ ...FORM, company: 'Failing Mail Ltd' });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.confirmationSent, false);

    const admin = await api.signIn('admin');
    const list = await api.call<ListView>('/api/inquiries?q=failing', { token: admin.token });
    assert.deepEqual(list.json.data.items[0]?.notifications, { team: 'failed', visitor: 'failed' });
  });
});

describe('inquiries in the dashboard', () => {
  it('is limited to roles with the inquiry permissions', async () => {
    for (const role of ['viewer', 'author', 'content_manager'] as const) {
      const user = await api.signIn(role);
      assert.equal((await api.call('/api/inquiries', { token: user.token })).status, 403, role);
    }
    assert.equal((await api.call('/api/inquiries')).status, 401);
    const admin = await api.signIn('admin');
    assert.equal((await api.call('/api/inquiries', { token: admin.token })).status, 200);
  });

  it('opens, updates, replies to and deletes an inquiry', async () => {
    const admin = await api.signIn('admin', 'Rahim Ahmed');
    const created = await submit({ ...FORM, company: 'Lifecycle GmbH' });
    const list = await api.call<ListView>('/api/inquiries?status=new&q=lifecycle', {
      token: admin.token,
    });
    const id = list.json.data.items[0]?.id ?? '';
    assert.ok(id);

    const statsBefore = await api.call<Record<string, number>>('/api/inquiries/stats', {
      token: admin.token,
    });
    const opened = await api.call<InquiryView>(`/api/inquiries/${id}/open`, {
      method: 'POST',
      token: admin.token,
    });
    assert.equal(opened.json.data.status, 'open');
    const statsAfter = await api.call<Record<string, number>>('/api/inquiries/stats', {
      token: admin.token,
    });
    assert.equal(statsAfter.json.data.new, (statsBefore.json.data.new ?? 0) - 1);
    assert.equal(statsAfter.json.data.all, statsBefore.json.data.all);

    const noted = await api.call<InquiryView>(`/api/inquiries/${id}`, {
      method: 'PATCH',
      token: admin.token,
      body: { note: 'Send the price list too.' },
    });
    assert.equal(noted.json.data.note, 'Send the price list too.');
    assert.equal(noted.json.data.status, 'open');
    const empty = await api.call(`/api/inquiries/${id}`, {
      method: 'PATCH',
      token: admin.token,
      body: {},
    });
    assert.equal(empty.status, 400);

    // A failed send is reported and nothing is recorded.
    api.mailer.failWith = new Error('provider down');
    const failed = await api.call(`/api/inquiries/${id}/reply`, {
      method: 'POST',
      token: admin.token,
      body: { message: 'Thanks, prices attached.' },
    });
    assert.equal(failed.status, 502);
    api.mailer.failWith = null;

    const sent = api.mailer.sent.length;
    const replied = await api.call<InquiryView>(`/api/inquiries/${id}/reply`, {
      method: 'POST',
      token: admin.token,
      body: { message: 'Thanks, prices attached.\nBest regards' },
    });
    assert.equal(replied.status, 200);
    assert.equal(replied.json.data.status, 'replied');
    assert.equal(replied.json.data.replies.length, 1);
    assert.equal(replied.json.data.replies[0]?.sentBy?.name, 'Rahim Ahmed');
    const email = api.mailer.sent[sent];
    assert.equal(email?.to, 'anna.berg@example.com');
    assert.ok(email?.subject.includes(created.json.data.reference));
    assert.ok(email?.html.includes('Thanks, prices attached.<br>Best regards'));

    // Opening again does not undo "replied".
    const reopened = await api.call<InquiryView>(`/api/inquiries/${id}/open`, {
      method: 'POST',
      token: admin.token,
    });
    assert.equal(reopened.json.data.status, 'replied');

    const removed = await api.call(`/api/inquiries/${id}`, {
      method: 'DELETE',
      token: admin.token,
    });
    assert.equal(removed.status, 200);
    assert.equal((await api.call(`/api/inquiries/${id}`, { token: admin.token })).status, 404);
    assert.equal(
      (await api.call(`/api/inquiries/${id}`, { method: 'DELETE', token: admin.token })).status,
      404,
    );
  });
});

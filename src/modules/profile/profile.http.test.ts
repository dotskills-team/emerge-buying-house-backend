import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { TEST_PASSWORD } from '../../test/helpers.js';
import { startIntegration, type Integration } from '../../test/integration.js';

let api: Integration;
before(async () => {
  api = await startIntegration();
});
after(async () => {
  await api.stop();
});

const NEW_PASSWORD = 'my brand new passphrase';

describe('profile', () => {
  it('shows the account and updates only the name', async () => {
    const user = await api.signIn('author');
    const profile = await api.call<{ email: string; roleName: string; permissions: string[] }>(
      '/api/profile',
      { token: user.token },
    );
    assert.equal(profile.status, 200);
    assert.equal(profile.json.data.email, user.email);
    assert.equal(profile.json.data.roleName, 'Author');

    const renamed = await api.call<{ name: string }>('/api/profile', {
      method: 'PATCH',
      token: user.token,
      body: { name: 'Pen Name' },
    });
    assert.equal(renamed.json.data.name, 'Pen Name');

    // Protected fields are rejected outright rather than silently ignored.
    const sneaky = await api.call('/api/profile', {
      method: 'PATCH',
      token: user.token,
      body: { name: 'Pen Name', role: 'super_admin' },
    });
    assert.equal(sneaky.status, 400);
    const me = await api.call<{ user: { role: string } }>('/api/auth/me', { token: user.token });
    assert.equal(me.json.data.user.role, 'author');
  });

  it('changes the password with the current one and keeps this session', async () => {
    const user = await api.signIn('viewer');
    const wrong = await api.call('/api/profile/password', {
      method: 'POST',
      token: user.token,
      body: { currentPassword: 'not it', newPassword: NEW_PASSWORD },
    });
    assert.equal(wrong.json.code, 'INVALID_CURRENT_PASSWORD');

    const weak = await api.call('/api/profile/password', {
      method: 'POST',
      token: user.token,
      body: { currentPassword: TEST_PASSWORD, newPassword: 'short' },
    });
    assert.equal(weak.status, 400);

    const changed = await api.call('/api/profile/password', {
      method: 'POST',
      token: user.token,
      body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
    });
    assert.equal(changed.status, 200);
    assert.equal((await api.call('/api/auth/me', { token: user.token })).status, 200);

    const login = await api.call('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: NEW_PASSWORD },
    });
    assert.equal(login.status, 200);
  });
});

describe('forgot and reset password', () => {
  it('answers generically, emails a link, and resets exactly once', async () => {
    const user = await api.signIn('viewer');

    const unknown = await api.call<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'ghost@example.com' },
    });
    const known = await api.call<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: user.email },
    });
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.json, known.json);
    assert.equal(api.mailer.sent.length, 1);

    const token = /#token=([\w-]+)/.exec(api.mailer.sent[0]?.text ?? '')?.[1] ?? '';
    assert.ok(token);

    const verify = await api.call('/api/auth/reset-password/verify', {
      method: 'POST',
      body: { token },
    });
    assert.equal(verify.status, 200);

    const reset = await api.call('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: NEW_PASSWORD },
    });
    assert.equal(reset.status, 200);
    assert.equal((await api.call('/api/auth/me', { token: user.token })).status, 401);

    const reuse = await api.call('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: 'another passphrase here' },
    });
    assert.equal(reuse.json.code, 'INVALID_RESET_TOKEN');

    const login = await api.call('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: NEW_PASSWORD },
    });
    assert.equal(login.status, 200);
  });
});

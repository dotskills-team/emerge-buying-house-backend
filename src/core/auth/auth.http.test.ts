import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../../app.js';
import { TEST_EMAIL, TEST_PASSWORD, createContext } from '../../test/helpers.js';

let server: Server;
let base = '';

before(async () => {
  const ctx = await createContext();
  server = createApp({ authService: ctx.service }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

interface Json {
  success?: boolean;
  code?: string;
  message?: string;
  errors?: unknown[];
  data: { accessToken: string; expiresIn: number; refreshToken?: string; user: { email: string } };
}

interface Call {
  method?: string;
  body?: unknown;
  token?: string;
  cookie?: string;
  origin?: string;
  rawBody?: string;
}

async function call(path: string, opts: Call = {}) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined || opts.rawBody !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.cookie = `bh_refresh=${opts.cookie}`;
  if (opts.origin) headers.origin = opts.origin;
  const res = await fetch(base + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('bh_refresh=')) ?? null;
  return { res, status: res.status, json: (await res.json()) as Json, setCookie };
}

const cookieValue = (setCookie: string | null) => setCookie?.split(';')[0]?.split('=')[1] ?? '';

describe('auth HTTP API', () => {
  let accessToken = '';
  let refreshCookie = '';

  it('validates the login body and malformed JSON', async () => {
    const invalid = await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'nope', password: '' },
    });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.json.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(invalid.json.errors));

    const broken = await call('/api/auth/login', { method: 'POST', rawBody: '{oops' });
    assert.equal(broken.status, 400);
    assert.equal(broken.json.success, false);
  });

  it('rejects wrong credentials with a generic 401', async () => {
    const r = await call('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'wrong' },
    });
    assert.equal(r.status, 401);
    assert.equal(r.json.code, 'INVALID_CREDENTIALS');
    assert.equal(r.setCookie, null);
  });

  it('logs in: access token in the body, refresh token only in an HttpOnly cookie', async () => {
    const r = await call('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL.toUpperCase(), password: TEST_PASSWORD },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
    assert.equal(typeof r.json.data.accessToken, 'string');
    assert.equal(r.json.data.expiresIn, 900);
    assert.equal(r.json.data.user.email, TEST_EMAIL);
    assert.equal(r.json.data.refreshToken, undefined);
    assert.equal(r.res.headers.get('cache-control'), 'no-store');

    assert.ok(r.setCookie);
    assert.match(r.setCookie, /HttpOnly/i);
    assert.match(r.setCookie, /SameSite=Strict/i);
    assert.match(r.setCookie, /Path=\/api\/auth/i);

    accessToken = r.json.data.accessToken;
    refreshCookie = cookieValue(r.setCookie);
  });

  it('protects /me and returns the current user without secrets', async () => {
    const anon = await call('/api/auth/me');
    assert.equal(anon.status, 401);
    assert.equal(anon.json.code, 'ACCESS_TOKEN_MISSING');

    const bad = await call('/api/auth/me', { token: 'junk' });
    assert.equal(bad.json.code, 'ACCESS_TOKEN_INVALID');

    const me = await call('/api/auth/me', { token: accessToken });
    assert.equal(me.status, 200);
    assert.equal(me.json.data.user.email, TEST_EMAIL);
    assert.equal(JSON.stringify(me.json).includes('passwordHash'), false);
  });

  it('rejects requests from a foreign origin', async () => {
    const r = await call('/api/auth/refresh', {
      method: 'POST',
      cookie: refreshCookie,
      origin: 'http://evil.example',
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'ORIGIN_NOT_ALLOWED');
  });

  it('refreshes from the cookie, rotating it', async () => {
    const none = await call('/api/auth/refresh', { method: 'POST' });
    assert.equal(none.status, 401);
    assert.equal(none.json.code, 'REFRESH_TOKEN_MISSING');

    const r = await call('/api/auth/refresh', {
      method: 'POST',
      cookie: refreshCookie,
      origin: 'http://localhost:3000',
    });
    assert.equal(r.status, 200);
    const rotated = cookieValue(r.setCookie);
    assert.ok(rotated && rotated !== refreshCookie);

    // The old cookie was just spent: a race, so 401 but the cookie is not cleared.
    const raced = await call('/api/auth/refresh', { method: 'POST', cookie: refreshCookie });
    assert.equal(raced.status, 401);
    assert.equal(raced.json.code, 'REFRESH_CONFLICT');
    assert.equal(raced.setCookie, null);

    accessToken = r.json.data.accessToken;
    refreshCookie = rotated;
  });

  it('logs out: revokes the session server-side and clears the cookie', async () => {
    const out = await call('/api/auth/logout', { method: 'POST', cookie: refreshCookie });
    assert.equal(out.status, 200);
    assert.ok(out.setCookie);
    assert.match(out.setCookie, /^bh_refresh=;/);

    const me = await call('/api/auth/me', { token: accessToken });
    assert.equal(me.status, 401);
    assert.equal(me.json.code, 'SESSION_REVOKED');

    const again = await call('/api/auth/refresh', { method: 'POST', cookie: refreshCookie });
    assert.equal(again.status, 401);
    assert.equal(again.json.code, 'SESSION_REVOKED');
    assert.ok(again.setCookie); // dead session: cookie is cleared

    const twice = await call('/api/auth/logout', { method: 'POST' });
    assert.equal(twice.status, 200); // idempotent, even without a cookie
  });

  it('returns JSON 404s for unknown routes', async () => {
    const r = await call('/api/nope');
    assert.equal(r.status, 404);
    assert.equal(r.json.success, false);
  });
});
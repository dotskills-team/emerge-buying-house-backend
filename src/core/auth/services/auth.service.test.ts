import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SignJWT } from 'jose';
import { DAY, MINUTE, TEST_EMAIL, TEST_PASSWORD, createContext } from '../../../test/helpers.js';
import { hashRefreshToken } from '../utils/tokens.js';

const rejectsWith = (code: string) => (err: unknown) => {
  assert.equal((err as { code?: string }).code, code);
  return true;
};

describe('login', () => {
  it('returns tokens and a public user, and stores only the refresh token hash', async () => {
    const ctx = await createContext();
    const result = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});

    assert.deepEqual(result.user, { id: ctx.user.id, name: 'Test User', email: TEST_EMAIL });
    assert.equal(result.expiresIn, 900);
    const [stored] = [...ctx.sessions.items.values()];
    assert.equal(stored?.tokenHash, hashRefreshToken(result.refreshToken));
    assert.notEqual(stored?.tokenHash, result.refreshToken);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const ctx = await createContext();
    const errorOf = (p: Promise<unknown>) =>
      p.then(
        () => assert.fail('expected a rejection'),
        (e: { message: string; code?: string }) => e,
      );
    const wrong = await errorOf(ctx.service.login(TEST_EMAIL, 'nope', {}));
    const unknown = await errorOf(ctx.service.login('who@example.com', 'nope', {}));
    assert.equal(wrong.message, unknown.message);
    assert.equal(wrong.code, 'INVALID_CREDENTIALS');
    assert.equal(unknown.code, 'INVALID_CREDENTIALS');
  });

  it('locks the account after repeated failures, then unlocks after the lock time', async () => {
    const ctx = await createContext();
    for (let i = 0; i < 5; i++) await ctx.service.login(TEST_EMAIL, 'bad', {}).catch(() => null);

    await assert.rejects(
      ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {}),
      rejectsWith('ACCOUNT_LOCKED'),
    );
    ctx.advance(16 * MINUTE);
    const ok = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    assert.ok(ok.accessToken);
  });

  it('refuses disabled accounts', async () => {
    const ctx = await createContext();
    ctx.user.isActive = false;
    await assert.rejects(
      ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {}),
      rejectsWith('ACCOUNT_DISABLED'),
    );
  });
});

describe('refresh token rotation', () => {
  it('issues a new token, spends the old one and keeps the access token valid', async () => {
    const ctx = await createContext();
    const first = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    const second = await ctx.service.refresh(first.refreshToken, {});

    assert.notEqual(second.refreshToken, first.refreshToken);
    const oldSession = await ctx.sessions.findByTokenHash(hashRefreshToken(first.refreshToken));
    assert.equal(oldSession?.status, 'rotated');
    const me = await ctx.service.authenticate(second.accessToken);
    assert.equal(me.user.email, TEST_EMAIL);
  });

  it('treats a just-spent token as a race: rejects it but keeps the login alive', async () => {
    const ctx = await createContext();
    const first = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    const second = await ctx.service.refresh(first.refreshToken, {});

    await assert.rejects(
      ctx.service.refresh(first.refreshToken, {}),
      rejectsWith('REFRESH_CONFLICT'),
    );
    const third = await ctx.service.refresh(second.refreshToken, {});
    assert.ok(third.accessToken);
  });

  it('revokes the whole login when a spent token is replayed after the grace window', async () => {
    const ctx = await createContext();
    const first = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    const second = await ctx.service.refresh(first.refreshToken, {});
    ctx.advance(60_000);

    await assert.rejects(
      ctx.service.refresh(first.refreshToken, {}),
      rejectsWith('REFRESH_TOKEN_REUSED'),
    );
    await assert.rejects(
      ctx.service.refresh(second.refreshToken, {}),
      rejectsWith('SESSION_REVOKED'),
    );
    await assert.rejects(
      ctx.service.authenticate(second.accessToken),
      rejectsWith('SESSION_REVOKED'),
    );
  });

  it('lets exactly one of two concurrent refreshes with the same token win', async () => {
    const ctx = await createContext();
    const first = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    const results = await Promise.allSettled([
      ctx.service.refresh(first.refreshToken, {}),
      ctx.service.refresh(first.refreshToken, {}),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      ((rejected[0] as PromiseRejectedResult).reason as { code?: string }).code,
      'REFRESH_CONFLICT',
    );
  });

  it('rejects expired refresh tokens and caps the login at its absolute lifetime', async () => {
    const ctx = await createContext({ refreshTtlMs: 7 * DAY, sessionMaxMs: 10 * DAY });
    const start = ctx.clock.time;
    const first = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});

    ctx.advance(6 * DAY);
    const second = await ctx.service.refresh(first.refreshToken, {});
    assert.equal(second.refreshExpiresAt.getTime(), start + 10 * DAY); // capped, not +13 days

    ctx.advance(5 * DAY);
    await assert.rejects(
      ctx.service.refresh(second.refreshToken, {}),
      rejectsWith('SESSION_EXPIRED'),
    );

    const ctx2 = await createContext();
    const fresh = await ctx2.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    ctx2.advance(8 * DAY);
    await assert.rejects(
      ctx2.service.refresh(fresh.refreshToken, {}),
      rejectsWith('SESSION_EXPIRED'),
    );
  });

  it('rejects missing and unknown tokens, and disabled users', async () => {
    const ctx = await createContext();
    await assert.rejects(ctx.service.refresh(undefined, {}), rejectsWith('REFRESH_TOKEN_MISSING'));
    await assert.rejects(ctx.service.refresh('garbage', {}), rejectsWith('INVALID_REFRESH_TOKEN'));

    const login = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    ctx.user.isActive = false;
    await assert.rejects(
      ctx.service.refresh(login.refreshToken, {}),
      rejectsWith('SESSION_REVOKED'),
    );
  });
});

describe('logout', () => {
  it('revokes the login server-side, immediately invalidating access and refresh tokens', async () => {
    const ctx = await createContext();
    const login = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    const next = await ctx.service.refresh(login.refreshToken, {});

    await ctx.service.logout(next.refreshToken);

    await assert.rejects(ctx.service.authenticate(next.accessToken), rejectsWith('SESSION_REVOKED'));
    await assert.rejects(ctx.service.refresh(next.refreshToken, {}), rejectsWith('SESSION_REVOKED'));
  });

  it('is idempotent and tolerates a missing or unknown token', async () => {
    const ctx = await createContext();
    const login = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    await ctx.service.logout(login.refreshToken);
    await ctx.service.logout(login.refreshToken);
    await ctx.service.logout(undefined);
    await ctx.service.logout('unknown');
  });

  it('never leaves a live session when logout races a refresh', async () => {
    const ctx = await createContext();
    const wait = async (n: number) => {
      for (let i = 0; i < n; i++) {
        await (i % 2 ? new Promise((r) => setImmediate(r)) : Promise.resolve());
      }
    };

    for (let delay = 0; delay < 10; delay++) {
      const login = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
      const [refreshed] = await Promise.allSettled([
        ctx.service.refresh(login.refreshToken, {}),
        wait(delay).then(() => ctx.service.logout(login.refreshToken)),
      ]);

      const familyId = [...ctx.sessions.items.values()].at(-1)?.familyId ?? '';
      assert.equal(
        await ctx.sessions.hasActiveInFamily(familyId, new Date(ctx.clock.time)),
        false,
        `delay ${delay}`,
      );
      if (refreshed.status === 'fulfilled') {
        await assert.rejects(ctx.service.authenticate(refreshed.value.accessToken));
      }
    }
  });
});

describe('authenticate', () => {
  it('rejects expired, garbage and foreign-signed access tokens', async () => {
    const ctx = await createContext();
    const login = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});

    await assert.rejects(ctx.service.authenticate('not-a-jwt'), rejectsWith('ACCESS_TOKEN_INVALID'));

    const forged = await new SignJWT({ sid: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ctx.user.id)
      .setIssuer('emerge-buying-house')
      .setAudience('emerge-buying-house-web')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('another-secret-another-secret-12345'));
    await assert.rejects(ctx.service.authenticate(forged), rejectsWith('ACCESS_TOKEN_INVALID'));

    ctx.advance(16 * MINUTE);
    await assert.rejects(
      ctx.service.authenticate(login.accessToken),
      rejectsWith('ACCESS_TOKEN_EXPIRED'),
    );
  });
});
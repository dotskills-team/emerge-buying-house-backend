import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MINUTE,
  TEST_EMAIL,
  TEST_PASSWORD,
  createContext,
  type TestContext,
} from '../../../test/helpers.js';
import { verifyPassword } from '../utils/password.js';

const NEW_PASSWORD = 'a brand new passphrase 42';

const rejectsWith = (code: string) => (err: unknown) => {
  assert.equal((err as { code?: string }).code, code);
  return true;
};

/** Pulls the raw token out of the emailed link (it travels in the URL fragment). */
function tokenFromMail(ctx: TestContext): string {
  const mail = ctx.mailer.sent.at(-1);
  assert.ok(mail, 'expected an email');
  const match = /reset-password#token=([\w-]+)/.exec(mail.text);
  assert.ok(match?.[1], 'expected a reset link');
  return match[1];
}

describe('password reset', () => {
  it('emails a single-use link and stores only the token hash', async () => {
    const ctx = await createContext();
    await ctx.passwords.requestReset(TEST_EMAIL);

    const token = tokenFromMail(ctx);
    assert.equal(ctx.mailer.sent[0]?.to, TEST_EMAIL);
    const [stored] = [...ctx.resets.items.values()];
    assert.ok(stored);
    assert.notEqual(stored.tokenHash, token);
    assert.equal(ctx.mailer.sent[0]?.html.includes(token), true);
  });

  it('behaves identically for unknown and disabled accounts, sending nothing', async () => {
    const ctx = await createContext();
    await ctx.passwords.requestReset('nobody@example.com');
    ctx.user.isActive = false;
    await ctx.passwords.requestReset(TEST_EMAIL);
    assert.equal(ctx.mailer.sent.length, 0);
    assert.equal(ctx.resets.items.size, 0);
  });

  it('refuses honestly when no email provider is configured', async () => {
    const ctx = await createContext({}, { mailerConfigured: false });
    await assert.rejects(
      ctx.passwords.requestReset(TEST_EMAIL),
      rejectsWith('EMAIL_NOT_CONFIGURED'),
    );
  });

  it('does not reveal delivery failures to the caller', async () => {
    const ctx = await createContext();
    ctx.mailer.failWith = new Error('provider down');
    await ctx.passwords.requestReset(TEST_EMAIL); // resolves: same response as success
  });

  it('resets the password, ends every session and cannot be reused', async () => {
    const ctx = await createContext();
    const login = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    await ctx.passwords.requestReset(TEST_EMAIL);
    const token = tokenFromMail(ctx);

    await ctx.passwords.verifyResetToken(token);
    await ctx.passwords.resetPassword(token, NEW_PASSWORD);

    assert.equal(await verifyPassword(NEW_PASSWORD, ctx.user.passwordHash), true);
    await assert.rejects(
      ctx.service.authenticate(login.accessToken),
      rejectsWith('SESSION_REVOKED'),
    );
    await assert.rejects(
      ctx.passwords.resetPassword(token, 'yet another passphrase'),
      rejectsWith('INVALID_RESET_TOKEN'),
    );
    assert.equal(ctx.audits.at(-1)?.action, 'auth.password.reset');
  });

  it('rejects expired links', async () => {
    const ctx = await createContext();
    await ctx.passwords.requestReset(TEST_EMAIL);
    const token = tokenFromMail(ctx);
    ctx.advance(31 * MINUTE);
    await assert.rejects(ctx.passwords.verifyResetToken(token), rejectsWith('INVALID_RESET_TOKEN'));
    await assert.rejects(
      ctx.passwords.resetPassword(token, NEW_PASSWORD),
      rejectsWith('INVALID_RESET_TOKEN'),
    );
  });

  it('only the newest link works', async () => {
    const ctx = await createContext();
    await ctx.passwords.requestReset(TEST_EMAIL);
    const first = tokenFromMail(ctx);
    await ctx.passwords.requestReset(TEST_EMAIL);
    const second = tokenFromMail(ctx);
    await assert.rejects(ctx.passwords.verifyResetToken(first), rejectsWith('INVALID_RESET_TOKEN'));
    await ctx.passwords.verifyResetToken(second);
  });

  it('lets exactly one of two concurrent resets with the same link succeed', async () => {
    const ctx = await createContext();
    await ctx.passwords.requestReset(TEST_EMAIL);
    const token = tokenFromMail(ctx);
    const results = await Promise.allSettled([
      ctx.passwords.resetPassword(token, NEW_PASSWORD),
      ctx.passwords.resetPassword(token, 'a different passphrase'),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  });
});

describe('change password', () => {
  it('requires the current password', async () => {
    const ctx = await createContext();
    await assert.rejects(
      ctx.passwords.changePassword({
        userId: ctx.user.id,
        currentPassword: 'wrong',
        newPassword: NEW_PASSWORD,
        keepFamilyId: 'x',
      }),
      rejectsWith('INVALID_CURRENT_PASSWORD'),
    );
  });

  it('rejects reusing the current password', async () => {
    const ctx = await createContext();
    await assert.rejects(
      ctx.passwords.changePassword({
        userId: ctx.user.id,
        currentPassword: TEST_PASSWORD,
        newPassword: TEST_PASSWORD,
        keepFamilyId: 'x',
      }),
      rejectsWith('PASSWORD_UNCHANGED'),
    );
  });

  it('keeps the current login and signs out every other device', async () => {
    const ctx = await createContext();
    const here = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    const elsewhere = await ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {});
    const { familyId } = await ctx.service.authenticate(here.accessToken);

    await ctx.passwords.changePassword({
      userId: ctx.user.id,
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
      keepFamilyId: familyId,
    });

    await ctx.service.authenticate(here.accessToken);
    await assert.rejects(
      ctx.service.authenticate(elsewhere.accessToken),
      rejectsWith('SESSION_REVOKED'),
    );
    await assert.rejects(
      ctx.service.login(TEST_EMAIL, TEST_PASSWORD, {}),
      rejectsWith('INVALID_CREDENTIALS'),
    );
    assert.equal(ctx.audits.at(-1)?.action, 'auth.password.change');
  });
});

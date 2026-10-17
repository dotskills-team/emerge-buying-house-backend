import type { RequestHandler } from 'express';
import { createAuthService } from '../core/auth/services/auth.service.js';
import { createPasswordService } from '../core/auth/services/password.service.js';
import type { AuthConfig } from '../core/auth/types/index.js';
import { hashPassword } from '../core/auth/utils/password.js';
import type { AuthLimiters } from '../middleware/rate-limit.middleware.js';
import type { AuditEntry } from '../modules/audit/services/audit.service.js';
import {
  MemoryMailer,
  MemoryResetTokenRepository,
  MemorySessionRepository,
  MemoryUserRepository,
  defaultAccessResolver,
} from './memory-repositories.js';

export const TEST_EMAIL = 'user@example.com';
export const TEST_PASSWORD = 'correct horse battery staple';

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

// scrypt is deliberately slow, so the test password's hash is computed once and shared.
let sharedHash: Promise<string> | undefined;
export const testPasswordHash = () => (sharedHash ??= hashPassword(TEST_PASSWORD));

export const defaultConfig: AuthConfig = {
  accessSecret: 'test-secret-test-secret-test-secret-0123',
  accessTtlSeconds: 15 * 60,
  refreshTtlMs: 7 * DAY,
  sessionMaxMs: 30 * DAY,
  reuseGraceMs: 10_000,
  maxFailedAttempts: 5,
  lockMs: 15 * MINUTE,
};

const passThrough: RequestHandler = (_req, _res, next) => next();
/** Disables rate limiting for tests that are not about rate limiting. */
export const noLimits: AuthLimiters = {
  login: passThrough,
  passwordReset: passThrough,
  passwordChange: passThrough,
};

export async function createContext(
  overrides: Partial<AuthConfig> = {},
  options: { mailerConfigured?: boolean } = {},
) {
  const clock = { time: Date.parse('2026-01-01T00:00:00.000Z') };
  const now = () => new Date(clock.time);
  const users = new MemoryUserRepository();
  const sessions = new MemorySessionRepository();
  const resets = new MemoryResetTokenRepository();
  const mailer = new MemoryMailer(options.mailerConfigured ?? true);
  const audits: AuditEntry[] = [];
  const config = { ...defaultConfig, ...overrides };
  const service = createAuthService({
    users,
    sessions,
    access: defaultAccessResolver,
    config,
    now,
  });
  const passwords = createPasswordService({
    users,
    sessions,
    resets,
    mailer,
    audit: async (entry) => {
      audits.push(entry);
    },
    config: { resetTtlMs: 30 * MINUTE, appUrl: 'http://localhost:3000', appName: 'Test App' },
    now,
  });
  const user = await users.create({
    name: 'Test User',
    email: TEST_EMAIL,
    passwordHash: await testPasswordHash(),
    role: 'viewer',
  });
  return {
    clock,
    users,
    sessions,
    resets,
    mailer,
    audits,
    config,
    service,
    passwords,
    user,
    advance: (ms: number) => {
      clock.time += ms;
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createContext>>;

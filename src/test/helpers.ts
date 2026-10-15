import { createAuthService } from '../core/auth/services/auth.service.js';
import type { AuthConfig } from '../core/auth/types/index.js';
import { hashPassword } from '../core/auth/utils/password.js';
import { MemorySessionRepository, MemoryUserRepository } from './memory-repositories.js';

export const TEST_EMAIL = 'user@example.com';
export const TEST_PASSWORD = 'correct horse battery staple';

export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

// scrypt is deliberately slow, so the test user's hash is computed once and shared.
let sharedHash: Promise<string> | undefined;
const testPasswordHash = () => (sharedHash ??= hashPassword(TEST_PASSWORD));

export const defaultConfig: AuthConfig = {
  accessSecret: 'test-secret-test-secret-test-secret-0123',
  accessTtlSeconds: 15 * 60,
  refreshTtlMs: 7 * DAY,
  sessionMaxMs: 30 * DAY,
  reuseGraceMs: 10_000,
  maxFailedAttempts: 5,
  lockMs: 15 * MINUTE,
};

export async function createContext(overrides: Partial<AuthConfig> = {}) {
  const clock = { time: Date.parse('2026-01-01T00:00:00.000Z') };
  const users = new MemoryUserRepository();
  const sessions = new MemorySessionRepository();
  const config = { ...defaultConfig, ...overrides };
  const service = createAuthService({ users, sessions, config, now: () => new Date(clock.time) });
  const user = await users.create({
    name: 'Test User',
    email: TEST_EMAIL,
    passwordHash: await testPasswordHash(),
  });
  return {
    clock,
    users,
    sessions,
    config,
    service,
    user,
    advance: (ms: number) => {
      clock.time += ms;
    },
  };
}

export type TestContext = Awaited<ReturnType<typeof createContext>>;
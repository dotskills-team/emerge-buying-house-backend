import { env } from '../../config/env.js';
import { MongoUserRepository } from '../../modules/users/repositories/user.repository.js';
import { MongoSessionRepository } from './repositories/session.repository.js';
import { createAuthService, type AuthService } from './services/auth.service.js';
import type { AuthConfig } from './types/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildAuthConfig(): AuthConfig {
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    accessTtlSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    refreshTtlMs: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
    sessionMaxMs: env.SESSION_MAX_DAYS * DAY_MS,
    reuseGraceMs: 10_000,
    maxFailedAttempts: 5,
    lockMs: 15 * 60 * 1000,
  };
}

export function createDefaultAuthService(): AuthService {
  return createAuthService({
    users: new MongoUserRepository(),
    sessions: new MongoSessionRepository(),
    config: buildAuthConfig(),
  });
}
import { env } from '../../config/env.js';
import { createResendMailer } from '../../lib/mailer.js';
import { mongoAccessResolver } from '../../modules/access/services/access.service.js';
import { recordAudit } from '../../modules/audit/services/audit.service.js';
import { MongoUserRepository } from '../../modules/users/repositories/user.repository.js';
import { MongoResetTokenRepository } from './repositories/reset-token.repository.js';
import { MongoSessionRepository } from './repositories/session.repository.js';
import { createAuthService, type AuthService } from './services/auth.service.js';
import { createPasswordService, type PasswordService } from './services/password.service.js';
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

export function createDefaultAuthServices(): {
  authService: AuthService;
  passwordService: PasswordService;
} {
  const users = new MongoUserRepository();
  const sessions = new MongoSessionRepository();
  return {
    authService: createAuthService({
      users,
      sessions,
      access: mongoAccessResolver,
      config: buildAuthConfig(),
    }),
    passwordService: createPasswordService({
      users,
      sessions,
      resets: new MongoResetTokenRepository(),
      mailer: createResendMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
      audit: (entry) => recordAudit(entry),
      config: {
        resetTtlMs: env.PASSWORD_RESET_TTL_MINUTES * 60_000,
        appUrl: new URL(env.CLIENT_ORIGIN).origin,
        appName: env.APP_NAME,
      },
    }),
  };
}

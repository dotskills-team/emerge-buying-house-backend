import { randomUUID } from 'node:crypto';
import { HttpError } from '../../../middleware/error.middleware.js';
import type {
  AuthConfig,
  AuthResult,
  PublicUser,
  RequestMeta,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../types/index.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  AccessTokenError,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../utils/tokens.js';

export interface AuthDeps {
  users: UserRepository;
  sessions: SessionRepository;
  config: AuthConfig;
  now?: () => Date;
}

export type AuthService = ReturnType<typeof createAuthService>;

const fail = (status: number, message: string, code: string) => new HttpError(status, message, code);

// Verified against when the email is unknown, so response time does not reveal which emails exist.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('not-a-real-password'));

export function createAuthService({ users, sessions, config, now = () => new Date() }: AuthDeps) {
  const toPublic = (u: UserRecord): PublicUser => ({ id: u.id, name: u.name, email: u.email });

  async function issue(
    user: UserRecord,
    familyId: string,
    familyStartedAt: Date,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const t = now();
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = new Date(
      Math.min(t.getTime() + config.refreshTtlMs, familyStartedAt.getTime() + config.sessionMaxMs),
    );
    await sessions.create({
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      status: 'active',
      expiresAt: refreshExpiresAt,
      familyStartedAt,
      rotatedAt: null,
      userAgent: meta.userAgent ?? null,
    });
    const accessToken = await signAccessToken(
      config.accessSecret,
      { userId: user.id, familyId },
      config.accessTtlSeconds,
      t,
    );
    return {
      user: toPublic(user),
      accessToken,
      expiresIn: config.accessTtlSeconds,
      refreshToken,
      refreshExpiresAt,
    };
  }

  async function login(email: string, password: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await users.findByEmail(email);
    const t = now();

    if (user?.lockedUntil && user.lockedUntil > t) {
      throw fail(429, 'Too many failed attempts. Try again later.', 'ACCOUNT_LOCKED');
    }

    const valid = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());
    if (!user || !valid) {
      if (user) {
        const attempts = await users.incrementFailedAttempts(user.id);
        if (attempts >= config.maxFailedAttempts) {
          await users.lock(user.id, new Date(t.getTime() + config.lockMs));
        }
      }
      throw fail(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }
    if (!user.isActive) throw fail(403, 'This account is disabled.', 'ACCOUNT_DISABLED');

    await users.recordSuccessfulLogin(user.id, t);
    return issue(user, randomUUID(), t, meta);
  }

  /** Rotates the refresh token: the presented token is spent and a new one is issued. */
  async function refresh(rawToken: string | undefined, meta: RequestMeta): Promise<AuthResult> {
    if (!rawToken) throw fail(401, 'Refresh token missing.', 'REFRESH_TOKEN_MISSING');

    const session = await sessions.findByTokenHash(hashRefreshToken(rawToken));
    if (!session) throw fail(401, 'Invalid refresh token.', 'INVALID_REFRESH_TOKEN');
    const t = now();

    if (session.status === 'revoked') {
      throw fail(401, 'Session has been revoked.', 'SESSION_REVOKED');
    }

    if (session.status === 'rotated') {
      const justRotated =
        session.rotatedAt !== null && t.getTime() - session.rotatedAt.getTime() <= config.reuseGraceMs;
      // Two tabs/requests racing with the same token: reject the loser, keep the login alive.
      if (justRotated) throw fail(401, 'Refresh already in progress.', 'REFRESH_CONFLICT');
      // A spent token used later means it may have been stolen: kill the whole login.
      await sessions.revokeFamily(session.familyId);
      throw fail(401, 'Refresh token reuse detected. Sign in again.', 'REFRESH_TOKEN_REUSED');
    }

    const lifetimeOver = t.getTime() - session.familyStartedAt.getTime() >= config.sessionMaxMs;
    if (session.expiresAt <= t || lifetimeOver) {
      await sessions.revokeFamily(session.familyId);
      throw fail(401, 'Session expired. Sign in again.', 'SESSION_EXPIRED');
    }

    const user = await users.findById(session.userId);
    if (!user || !user.isActive) {
      await sessions.revokeFamily(session.familyId);
      throw fail(401, 'Session has been revoked.', 'SESSION_REVOKED');
    }

    if (!(await sessions.markRotated(session.id, t))) {
      throw fail(401, 'Refresh already in progress.', 'REFRESH_CONFLICT');
    }

    const result = await issue(user, session.familyId, session.familyStartedAt, meta);

    // A logout can land between the steps above. Revoking the family also revokes the spent
    // token, so seeing it revoked here means the new token must not survive.
    const parent = await sessions.findById(session.id);
    if (!parent || parent.status === 'revoked') {
      await sessions.revokeFamily(session.familyId);
      throw fail(401, 'Session has been revoked.', 'SESSION_REVOKED');
    }
    return result;
  }

  /** Idempotent: revokes the whole login (every token in the family). */
  async function logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const session = await sessions.findByTokenHash(hashRefreshToken(rawToken));
    if (session) await sessions.revokeFamily(session.familyId);
  }

  async function authenticate(accessToken: string): Promise<{ user: PublicUser; familyId: string }> {
    let claims;
    try {
      claims = await verifyAccessToken(config.accessSecret, accessToken, now());
    } catch (err) {
      if (err instanceof AccessTokenError) {
        const expired = err.reason === 'expired';
        throw fail(
          401,
          expired ? 'Access token expired.' : 'Invalid access token.',
          expired ? 'ACCESS_TOKEN_EXPIRED' : 'ACCESS_TOKEN_INVALID',
        );
      }
      throw err;
    }

    // Lets logout take effect immediately instead of waiting for the access token to expire.
    if (!(await sessions.hasActiveInFamily(claims.familyId, now()))) {
      throw fail(401, 'Session has been revoked.', 'SESSION_REVOKED');
    }
    const user = await users.findById(claims.userId);
    if (!user || !user.isActive) throw fail(401, 'Session has been revoked.', 'SESSION_REVOKED');

    return { user: toPublic(user), familyId: claims.familyId };
  }

  return { login, refresh, logout, authenticate };
}
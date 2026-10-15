export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export type SessionStatus = 'active' | 'rotated' | 'revoked';

/** One refresh token. All tokens created by rotating the same login share a `familyId`. */
export interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  status: SessionStatus;
  expiresAt: Date;
  familyStartedAt: Date;
  rotatedAt: Date | null;
  userAgent: string | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { name: string; email: string; passwordHash: string }): Promise<UserRecord>;
  /** Atomically increments and returns the new failed-attempt count. */
  incrementFailedAttempts(id: string): Promise<number>;
  /** Locks the account until `until` and resets the failed-attempt counter. */
  lock(id: string, until: Date): Promise<void>;
  recordSuccessfulLogin(id: string, at: Date): Promise<void>;
}

export interface SessionRepository {
  create(input: Omit<SessionRecord, 'id'>): Promise<SessionRecord>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  findById(id: string): Promise<SessionRecord | null>;
  /** Atomic compare-and-set from `active` to `rotated`. Returns false if it was not active. */
  markRotated(id: string, at: Date): Promise<boolean>;
  /** Marks every non-revoked session of the family as revoked. */
  revokeFamily(familyId: string): Promise<void>;
  hasActiveInFamily(familyId: string, now: Date): Promise<boolean>;
}

export interface AuthConfig {
  accessSecret: string;
  accessTtlSeconds: number;
  refreshTtlMs: number;
  /** Absolute lifetime of a login, no matter how often it is refreshed. */
  sessionMaxMs: number;
  /** A just-rotated token presented again within this window is a race, not theft. */
  reuseGraceMs: number;
  maxFailedAttempts: number;
  lockMs: number;
}

export interface RequestMeta {
  userAgent?: string | undefined;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}
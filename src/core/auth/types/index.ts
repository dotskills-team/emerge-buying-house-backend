import type { Permission, RoleKey } from '../../../modules/access/permissions.js';

/** What the API returns about the signed-in user. `permissions` are the effective ones. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  permissions: Permission[];
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: RoleKey;
  grants: Permission[];
  revokes: Permission[];
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: RoleKey;
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
  create(input: NewUser): Promise<UserRecord>;
  /** Atomically increments and returns the new failed-attempt count. */
  incrementFailedAttempts(id: string): Promise<number>;
  /** Locks the account until `until` and resets the failed-attempt counter. */
  lock(id: string, until: Date): Promise<void>;
  recordSuccessfulLogin(id: string, at: Date): Promise<void>;
  /** Replaces the password hash and clears any lockout. */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

export interface SessionRepository {
  create(input: Omit<SessionRecord, 'id'>): Promise<SessionRecord>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  findById(id: string): Promise<SessionRecord | null>;
  /** Atomic compare-and-set from `active` to `rotated`. Returns false if it was not active. */
  markRotated(id: string, at: Date): Promise<boolean>;
  /** Marks every non-revoked session of the family as revoked. */
  revokeFamily(familyId: string): Promise<void>;
  /** Revokes every login of the user, optionally keeping one family (the caller's own). */
  revokeAllForUser(userId: string, exceptFamilyId?: string): Promise<void>;
  hasActiveInFamily(familyId: string, now: Date): Promise<boolean>;
}

export interface ResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface ResetTokenRepository {
  create(input: Omit<ResetTokenRecord, 'id' | 'usedAt'>): Promise<ResetTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<ResetTokenRecord | null>;
  /** Atomic compare-and-set: marks an unused token used. Returns false if it was already used. */
  consume(id: string, at: Date): Promise<boolean>;
  /** Marks every unused token of the user used, so only the newest link works. */
  invalidateForUser(userId: string, at: Date): Promise<void>;
}

/** Works out a user's effective permissions (role permissions are stored in the database). */
export interface AccessResolver {
  permissionsFor(user: UserRecord): Promise<Permission[]>;
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

/** Stored on `res.locals.auth` by the require-auth middleware. */
export interface AuthContext {
  user: PublicUser;
  familyId: string;
}

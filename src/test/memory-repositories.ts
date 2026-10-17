import { randomUUID } from 'node:crypto';
import type {
  AccessResolver,
  NewUser,
  ResetTokenRecord,
  ResetTokenRepository,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../core/auth/types/index.js';
import type { Mail, Mailer } from '../lib/mailer.js';
import { DEFAULT_ROLES, resolvePermissions } from '../modules/access/permissions.js';

// Each method yields once so concurrent calls can interleave like real database round-trips.
// Every compare-and-set below runs synchronously after the yield, so it is atomic.
const tick = () => Promise.resolve();

export class MemoryUserRepository implements UserRepository {
  readonly items = new Map<string, UserRecord>();

  async findByEmail(email: string) {
    await tick();
    return [...this.items.values()].find((u) => u.email === email) ?? null;
  }

  async findById(id: string) {
    await tick();
    return this.items.get(id) ?? null;
  }

  async create(input: NewUser) {
    await tick();
    const user: UserRecord = {
      id: randomUUID(),
      ...input,
      grants: [],
      revokes: [],
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    this.items.set(user.id, user);
    return user;
  }

  async incrementFailedAttempts(id: string) {
    await tick();
    const user = this.items.get(id);
    if (!user) return 0;
    user.failedLoginAttempts += 1;
    return user.failedLoginAttempts;
  }

  async lock(id: string, until: Date) {
    await tick();
    const user = this.items.get(id);
    if (user) Object.assign(user, { lockedUntil: until, failedLoginAttempts: 0 });
  }

  async recordSuccessfulLogin(id: string) {
    await tick();
    const user = this.items.get(id);
    if (user) Object.assign(user, { lockedUntil: null, failedLoginAttempts: 0 });
  }

  async updatePassword(id: string, passwordHash: string) {
    await tick();
    const user = this.items.get(id);
    if (user) Object.assign(user, { passwordHash, lockedUntil: null, failedLoginAttempts: 0 });
  }
}

export class MemorySessionRepository implements SessionRepository {
  readonly items = new Map<string, SessionRecord>();

  async create(input: Omit<SessionRecord, 'id'>) {
    await tick();
    const session: SessionRecord = { id: randomUUID(), ...input };
    this.items.set(session.id, session);
    return session;
  }

  async findByTokenHash(tokenHash: string) {
    await tick();
    return [...this.items.values()].find((s) => s.tokenHash === tokenHash) ?? null;
  }

  async findById(id: string) {
    await tick();
    return this.items.get(id) ?? null;
  }

  async markRotated(id: string, at: Date) {
    await tick();
    const session = this.items.get(id);
    if (!session || session.status !== 'active') return false;
    session.status = 'rotated';
    session.rotatedAt = at;
    return true;
  }

  async revokeFamily(familyId: string) {
    await tick();
    for (const s of this.items.values()) if (s.familyId === familyId) s.status = 'revoked';
  }

  async revokeAllForUser(userId: string, exceptFamilyId?: string) {
    await tick();
    for (const s of this.items.values()) {
      if (s.userId === userId && s.familyId !== exceptFamilyId) s.status = 'revoked';
    }
  }

  async hasActiveInFamily(familyId: string, now: Date) {
    await tick();
    return [...this.items.values()].some(
      (s) => s.familyId === familyId && s.status === 'active' && s.expiresAt > now,
    );
  }
}

export class MemoryResetTokenRepository implements ResetTokenRepository {
  readonly items = new Map<string, ResetTokenRecord>();

  async create(input: Omit<ResetTokenRecord, 'id' | 'usedAt'>) {
    await tick();
    const record: ResetTokenRecord = { id: randomUUID(), usedAt: null, ...input };
    this.items.set(record.id, record);
    return record;
  }

  async findByTokenHash(tokenHash: string) {
    await tick();
    return [...this.items.values()].find((r) => r.tokenHash === tokenHash) ?? null;
  }

  async consume(id: string, at: Date) {
    await tick();
    const record = this.items.get(id);
    if (!record || record.usedAt) return false;
    record.usedAt = at;
    return true;
  }

  async invalidateForUser(userId: string, at: Date) {
    await tick();
    for (const r of this.items.values()) if (r.userId === userId && !r.usedAt) r.usedAt = at;
  }
}

/** Role permissions are the code defaults; no database involved. */
export const defaultAccessResolver: AccessResolver = {
  async permissionsFor(user) {
    return resolvePermissions(
      user.role,
      DEFAULT_ROLES[user.role].permissions,
      user.grants,
      user.revokes,
    );
  },
};

export class MemoryMailer implements Mailer {
  readonly sent: Mail[] = [];
  failWith: Error | null = null;
  constructor(readonly configured = true) {}

  async send(mail: Mail) {
    await tick();
    if (this.failWith) throw this.failWith;
    this.sent.push(mail);
  }
}

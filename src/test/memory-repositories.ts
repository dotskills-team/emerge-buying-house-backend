import { randomUUID } from 'node:crypto';
import type {
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../core/auth/types/index.js';

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

  async create(input: { name: string; email: string; passwordHash: string }) {
    await tick();
    const user: UserRecord = {
      id: randomUUID(),
      ...input,
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

  async hasActiveInFamily(familyId: string, now: Date) {
    await tick();
    return [...this.items.values()].some(
      (s) => s.familyId === familyId && s.status === 'active' && s.expiresAt > now,
    );
  }
}
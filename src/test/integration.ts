import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { buildAuthConfig } from '../core/auth/auth.factory.js';
import { MongoResetTokenRepository } from '../core/auth/repositories/reset-token.repository.js';
import { MongoSessionRepository } from '../core/auth/repositories/session.repository.js';
import { createAuthService } from '../core/auth/services/auth.service.js';
import { createPasswordService } from '../core/auth/services/password.service.js';
import { accessControl } from '../migrations/001-access-control.js';
import type { RoleKey } from '../modules/access/permissions.js';
import { mongoAccessResolver } from '../modules/access/services/access.service.js';
import { recordAudit } from '../modules/audit/services/audit.service.js';
import { CategoryModel } from '../modules/blog/models/category.model.js';
import { PostModel } from '../modules/blog/models/post.model.js';
import { UserModel } from '../modules/users/models/user.model.js';
import { MongoUserRepository } from '../modules/users/repositories/user.repository.js';
import { TEST_PASSWORD, noLimits, testPasswordHash } from './helpers.js';
import { MemoryMailer } from './memory-repositories.js';

export interface CallOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export interface ApiResponse<T = unknown> {
  status: number;
  json: { success: boolean; data: T; code?: string; message?: string };
  setCookie: string | null;
}

/**
 * A real app on a real (in-memory, single-node replica set) MongoDB, so queries, unique indexes
 * and transactions behave as in production. One instance per test file.
 */
export async function startIntegration() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replSet.getUri(), { dbName: 'test' });
  await accessControl.up();
  await Promise.all([UserModel.init(), PostModel.init(), CategoryModel.init()]);

  const mailer = new MemoryMailer();
  const users = new MongoUserRepository();
  const sessions = new MongoSessionRepository();
  const authService = createAuthService({
    users,
    sessions,
    access: mongoAccessResolver,
    config: buildAuthConfig(),
  });
  const passwordService = createPasswordService({
    users,
    sessions,
    resets: new MongoResetTokenRepository(),
    mailer,
    audit: (entry) => recordAudit(entry),
    config: { resetTtlMs: 30 * 60_000, appUrl: 'http://localhost:3000', appName: 'Test App' },
  });

  const server: Server = createApp({ authService, passwordService, limiters: noLimits }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function call<T = unknown>(path: string, opts: CallOptions = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    const res = await fetch(base + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('bh_refresh=')) ?? null;
    return { status: res.status, json: (await res.json()) as ApiResponse<T>['json'], setCookie };
  }

  let counter = 0;
  /** Creates a user directly in the database and signs them in. */
  async function signIn(role: RoleKey, name = `${role} user`) {
    counter += 1;
    const email = `${role}.${counter}@example.com`;
    const doc = await UserModel.create({
      name,
      email,
      passwordHash: await testPasswordHash(),
      role,
    });
    const login = await call<{ accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password: TEST_PASSWORD },
    });
    if (login.status !== 200) throw new Error(`login failed for ${email}: ${login.json.message}`);
    return { id: String(doc._id), email, token: login.json.data.accessToken };
  }

  async function stop() {
    server.close();
    await mongoose.disconnect();
    await replSet.stop();
  }

  return { call, signIn, mailer, stop };
}

export type Integration = Awaited<ReturnType<typeof startIntegration>>;

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AuditLogModel } from '../audit/models/audit-log.model.js';
import { startIntegration, type Integration } from '../../test/integration.js';
import type { AdminUserView } from './services/users.service.js';

let api: Integration;
before(async () => {
  api = await startIntegration();
});
after(async () => {
  await api.stop();
});

const newUser = (role: string, email: string) => ({
  name: 'New Person',
  email,
  password: 'a long enough password',
  role,
});

describe('authentication and authorization on /api/users', () => {
  it('requires a token, then the right permission', async () => {
    assert.equal((await api.call('/api/users')).status, 401);
    const viewer = await api.signIn('viewer');
    const r = await api.call('/api/users', { token: viewer.token });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'FORBIDDEN');
  });

  it('lets an admin list, create and edit users, recording each change', async () => {
    const admin = await api.signIn('admin');
    const created = await api.call<AdminUserView>('/api/users', {
      method: 'POST',
      token: admin.token,
      body: newUser('author', 'writer@example.com'),
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.role, 'author');
    assert.equal(JSON.stringify(created.json).includes('passwordHash'), false);

    const id = created.json.data.id;
    const edited = await api.call<AdminUserView>(`/api/users/${id}`, {
      method: 'PATCH',
      token: admin.token,
      body: { name: 'Renamed Person' },
    });
    assert.equal(edited.json.data.name, 'Renamed Person');

    const list = await api.call<{ items: AdminUserView[] }>('/api/users?q=renamed', {
      token: admin.token,
    });
    assert.equal(list.json.data.items.length, 1);

    const actions = await AuditLogModel.find({ targetId: id }).sort({ createdAt: 1 }).lean();
    assert.deepEqual(
      actions.map((a) => a.action),
      ['user.create', 'user.update'],
    );
  });

  it('rejects duplicate emails and invalid input', async () => {
    const admin = await api.signIn('admin');
    const body = newUser('viewer', 'dupe@example.com');
    assert.equal(
      (await api.call('/api/users', { method: 'POST', token: admin.token, body })).status,
      201,
    );
    const again = await api.call('/api/users', { method: 'POST', token: admin.token, body });
    assert.equal(again.status, 409);
    assert.equal(again.json.code, 'EMAIL_TAKEN');

    const bad = await api.call('/api/users', {
      method: 'POST',
      token: admin.token,
      body: { name: 'x', email: 'nope', password: 'short', role: 'emperor' },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.code, 'VALIDATION_ERROR');
  });
});

describe('Super Admin protection', () => {
  it('stops an admin from creating or touching Super Admins', async () => {
    const admin = await api.signIn('admin');
    const superAdmin = await api.signIn('super_admin');

    const create = await api.call('/api/users', {
      method: 'POST',
      token: admin.token,
      body: newUser('super_admin', 'sneaky@example.com'),
    });
    assert.equal(create.status, 403);

    for (const [path, body] of [
      ['', { name: 'Hacked' }],
      ['/role', { role: 'viewer' }],
      ['/status', { isActive: false }],
    ] as const) {
      const r = await api.call(`/api/users/${superAdmin.id}${path}`, {
        method: 'PATCH',
        token: admin.token,
        body,
      });
      assert.equal(r.status, 403, `PATCH ${path} should be forbidden`);
      assert.equal(r.json.code, 'PROTECTED_USER');
    }
  });

  it('stops users from changing their own role, status or permissions', async () => {
    const superAdmin = await api.signIn('super_admin');
    const r = await api.call(`/api/users/${superAdmin.id}/role`, {
      method: 'PATCH',
      token: superAdmin.token,
      body: { role: 'viewer' },
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'SELF_MODIFICATION');
  });

  it('never lets two Super Admins demote each other at the same time', async () => {
    // Only these two may be active Super Admins for the check to bite.
    const { UserModel } = await import('./models/user.model.js');
    await UserModel.updateMany({ role: 'super_admin' }, { $set: { isActive: false } });
    const a = await api.signIn('super_admin', 'Alpha');
    const b = await api.signIn('super_admin', 'Bravo');

    const [ab, ba] = await Promise.all([
      api.call(`/api/users/${b.id}/role`, {
        method: 'PATCH',
        token: a.token,
        body: { role: 'admin' },
      }),
      api.call(`/api/users/${a.id}/role`, {
        method: 'PATCH',
        token: b.token,
        body: { role: 'admin' },
      }),
    ]);
    const statuses = [ab.status, ba.status].sort();
    // One wins. The other either sees it was demoted (403/401) or hits the last-Super-Admin rule (409).
    assert.equal(statuses.filter((s) => s === 200).length, 1, `got ${statuses.join(', ')}`);
    assert.equal(await UserModel.countDocuments({ role: 'super_admin', isActive: true }), 1);
  });
});

describe('roles and individual permissions', () => {
  it('applies grants and revokes on the very next request', async () => {
    const superAdmin = await api.signIn('super_admin');
    const author = await api.signIn('author');

    assert.equal((await api.call('/api/users', { token: author.token })).status, 403);
    const granted = await api.call<AdminUserView>(`/api/users/${author.id}/permissions`, {
      method: 'PUT',
      token: superAdmin.token,
      body: { grants: ['users.read'], revokes: ['posts.create'] },
    });
    assert.equal(granted.status, 200);
    assert.ok(granted.json.data.permissions.includes('users.read'));
    assert.ok(!granted.json.data.permissions.includes('posts.create'));

    assert.equal((await api.call('/api/users', { token: author.token })).status, 200);
    const post = await api.call('/api/blog/admin/posts', {
      method: 'POST',
      token: author.token,
      body: { title: 'Should fail' },
    });
    assert.equal(post.status, 403);
  });

  it('rejects contradictory and escalating permission changes', async () => {
    const superAdmin = await api.signIn('super_admin');
    const admin = await api.signIn('admin');
    const viewer = await api.signIn('viewer');

    const conflict = await api.call(`/api/users/${viewer.id}/permissions`, {
      method: 'PUT',
      token: superAdmin.token,
      body: { grants: ['users.read'], revokes: ['users.read'] },
    });
    assert.equal(conflict.json.code, 'PERMISSION_CONFLICT');

    // Admins do not hold permissions.assign by default.
    const escalate = await api.call(`/api/users/${viewer.id}/permissions`, {
      method: 'PUT',
      token: admin.token,
      body: { grants: ['roles.manage'], revokes: [] },
    });
    assert.equal(escalate.status, 403);
  });

  it('deactivating a user ends their sessions immediately', async () => {
    const admin = await api.signIn('admin');
    const victim = await api.signIn('content_manager');
    assert.equal((await api.call('/api/auth/me', { token: victim.token })).status, 200);

    const off = await api.call(`/api/users/${victim.id}/status`, {
      method: 'PATCH',
      token: admin.token,
      body: { isActive: false },
    });
    assert.equal(off.status, 200);
    assert.equal((await api.call('/api/auth/me', { token: victim.token })).status, 401);
  });

  it('lists roles, lets only Super Admins edit them, and protects the Super Admin role', async () => {
    const admin = await api.signIn('admin');
    const superAdmin = await api.signIn('super_admin');

    const roles = await api.call<Array<{ key: string; permissions: string[] }>>('/api/roles', {
      token: admin.token,
    });
    assert.deepEqual(
      roles.json.data.map((r) => r.key),
      ['super_admin', 'admin', 'content_manager', 'author', 'viewer'],
    );

    const body = { permissions: ['posts.read', 'profile.read'] };
    assert.equal(
      (await api.call('/api/roles/viewer/permissions', { method: 'PUT', token: admin.token, body }))
        .status,
      403,
    );
    const changed = await api.call<{ permissions: string[] }>('/api/roles/viewer/permissions', {
      method: 'PUT',
      token: superAdmin.token,
      body,
    });
    assert.deepEqual(changed.json.data.permissions, ['posts.read', 'profile.read']);

    const protectedRole = await api.call('/api/roles/super_admin/permissions', {
      method: 'PUT',
      token: superAdmin.token,
      body,
    });
    assert.equal(protectedRole.json.code, 'PROTECTED_ROLE');

    const audit = await api.call<{ items: Array<{ action: string }> }>('/api/audit-logs', {
      token: admin.token,
    });
    assert.equal(audit.json.data.items[0]?.action, 'role.permissions.change');
  });
});

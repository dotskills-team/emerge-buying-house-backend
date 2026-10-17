import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_PERMISSIONS, DEFAULT_ROLES, ROLE_KEYS, resolvePermissions } from './permissions.js';

describe('permissions', () => {
  it('gives Super Admin everything, whatever is revoked', () => {
    assert.deepEqual(resolvePermissions('super_admin', [], [], ALL_PERMISSIONS), ALL_PERMISSIONS);
  });

  it('adds grants and removes revokes from the role', () => {
    const result = resolvePermissions(
      'viewer',
      DEFAULT_ROLES.viewer.permissions,
      ['users.read'],
      ['posts.read'],
    );
    assert.ok(result.includes('users.read'));
    assert.ok(!result.includes('posts.read'));
  });

  it('keeps every standard role short of Super Admin powers', () => {
    for (const key of ROLE_KEYS.filter((k) => k !== 'super_admin')) {
      const perms = DEFAULT_ROLES[key].permissions;
      assert.ok(!perms.includes('roles.manage'), `${key} must not manage roles`);
      assert.ok(!perms.includes('permissions.assign'), `${key} must not assign permissions`);
      assert.ok(
        perms.includes('auth.password.change'),
        `${key} must be able to change its password`,
      );
    }
  });
});

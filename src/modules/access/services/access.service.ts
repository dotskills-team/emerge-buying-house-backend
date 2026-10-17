import mongoose from 'mongoose';
import type { AccessResolver, PublicUser } from '../../../core/auth/types/index.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { recordAudit } from '../../audit/services/audit.service.js';
import { UserModel } from '../../users/models/user.model.js';
import { RoleModel } from '../models/role.model.js';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  PERMISSION_DEFS,
  ROLE_KEYS,
  SUPER_ADMIN,
  isPermission,
  resolvePermissions,
  type Permission,
  type RoleKey,
} from '../permissions.js';

export type RolePermissionMap = Record<RoleKey, Permission[]>;

/** Stored role permissions, falling back to the defaults for any role not yet in the database. */
export async function loadRolePermissions(): Promise<RolePermissionMap> {
  const docs = await RoleModel.find().select('key permissions').lean();
  const stored = new Map(docs.map((d) => [d.key, d.permissions.filter(isPermission)]));
  const of = (key: RoleKey) => stored.get(key) ?? DEFAULT_ROLES[key].permissions;
  return {
    super_admin: [...ALL_PERMISSIONS],
    admin: of('admin'),
    content_manager: of('content_manager'),
    author: of('author'),
    viewer: of('viewer'),
  };
}

export const mongoAccessResolver: AccessResolver = {
  async permissionsFor(user) {
    if (user.role === SUPER_ADMIN) return [...ALL_PERMISSIONS];
    const doc = await RoleModel.findOne({ key: user.role }).select('permissions').lean();
    const rolePermissions = doc
      ? doc.permissions.filter(isPermission)
      : DEFAULT_ROLES[user.role].permissions;
    return resolvePermissions(user.role, rolePermissions, user.grants, user.revokes);
  },
};

/** True when every permission in `wanted` is one the actor holds: nobody can hand out more than they have. */
export const holdsAll = (actor: PublicUser, wanted: readonly Permission[]) =>
  wanted.every((p) => actor.permissions.includes(p));

export function listPermissions() {
  return PERMISSION_DEFS.map(({ key, group, label }) => ({ key, group, label }));
}

export async function listRoles() {
  const [permissions, counts] = await Promise.all([
    loadRolePermissions(),
    UserModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
  ]);
  const countOf = new Map(counts.map((c) => [c._id, c.count]));
  return ROLE_KEYS.map((key) => ({
    key,
    name: DEFAULT_ROLES[key].name,
    description: DEFAULT_ROLES[key].description,
    permissions: permissions[key],
    protected: key === SUPER_ADMIN,
    userCount: countOf.get(key) ?? 0,
  }));
}

export async function updateRolePermissions(
  actor: PublicUser,
  key: RoleKey,
  permissions: Permission[],
) {
  if (key === SUPER_ADMIN) {
    throw new HttpError(403, 'The Super Admin role always has every permission.', 'PROTECTED_ROLE');
  }
  if (actor.role !== SUPER_ADMIN && actor.role === key) {
    throw new HttpError(
      403,
      'You cannot change the permissions of your own role.',
      'SELF_MODIFICATION',
    );
  }
  const next = ALL_PERMISSIONS.filter((p) => permissions.includes(p));
  if (!holdsAll(actor, next)) {
    throw new HttpError(
      403,
      'You cannot give a role permissions you do not have.',
      'PRIVILEGE_ESCALATION',
    );
  }

  await mongoose.connection.transaction(async (session) => {
    const existing = await RoleModel.findOne({ key }).session(session).lean();
    const before = existing
      ? existing.permissions.filter(isPermission)
      : DEFAULT_ROLES[key].permissions;
    await RoleModel.updateOne(
      { key },
      {
        $set: { permissions: next },
        $inc: { version: 1 },
        $setOnInsert: {
          name: DEFAULT_ROLES[key].name,
          description: DEFAULT_ROLES[key].description,
        },
      },
      { upsert: true, session },
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: 'role.permissions.change',
        targetType: 'role',
        targetId: key,
        details: {
          added: next.filter((p) => !before.includes(p)),
          removed: before.filter((p) => !next.includes(p)),
        },
      },
      session,
    );
  });

  const roles = await listRoles();
  return roles.find((r) => r.key === key);
}

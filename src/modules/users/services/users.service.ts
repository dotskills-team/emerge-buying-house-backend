import mongoose, { type ClientSession, type Types } from 'mongoose';
import { hashPassword } from '../../../core/auth/utils/password.js';
import type { PublicUser } from '../../../core/auth/types/index.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { escapeRegExp } from '../../../utils/regex.js';
import { RoleModel } from '../../access/models/role.model.js';
import {
  DEFAULT_ROLES,
  FALLBACK_ROLE,
  SUPER_ADMIN,
  isPermission,
  isRoleKey,
  resolvePermissions,
  type Permission,
  type RoleKey,
} from '../../access/permissions.js';
import {
  holdsAll,
  loadRolePermissions,
  type RolePermissionMap,
} from '../../access/services/access.service.js';
import { recordAudit } from '../../audit/services/audit.service.js';
import { MongoSessionRepository } from '../../../core/auth/repositories/session.repository.js';
import { UserModel } from '../models/user.model.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdatePermissionsInput,
  UpdateUserInput,
} from '../validators/users.validator.js';

interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role?: string | null;
  grants?: string[];
  revokes?: string[];
  isActive: boolean;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sessions = new MongoSessionRepository();

const roleOf = (d: UserDoc): RoleKey => (isRoleKey(d.role) ? d.role : FALLBACK_ROLE);

function toView(d: UserDoc, roles: RolePermissionMap) {
  const role = roleOf(d);
  const grants = (d.grants ?? []).filter(isPermission);
  const revokes = (d.revokes ?? []).filter(isPermission);
  return {
    id: d._id.toString(),
    name: d.name,
    email: d.email,
    role,
    grants,
    revokes,
    permissions: resolvePermissions(role, roles[role], grants, revokes),
    isActive: d.isActive,
    locked: Boolean(d.lockedUntil && d.lockedUntil > new Date()),
    lastLoginAt: d.lastLoginAt ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export type AdminUserView = ReturnType<typeof toView>;

const notFound = () => new HttpError(404, 'User not found.', 'USER_NOT_FOUND');
const forbidden = (message: string, code: string) => new HttpError(403, message, code);

/** Rules that apply to every change an administrator makes to another account. */
function assertCanManage(actor: PublicUser, target: UserDoc) {
  if (actor.id === target._id.toString()) {
    throw forbidden(
      'You cannot change your own account here. Use your profile page instead.',
      'SELF_MODIFICATION',
    );
  }
  if (roleOf(target) === SUPER_ADMIN && actor.role !== SUPER_ADMIN) {
    throw forbidden('Only a Super Admin can change a Super Admin account.', 'PROTECTED_USER');
  }
}

/** A role can be handed out only by someone who already holds all of its permissions. */
function assertCanAssignRole(actor: PublicUser, role: RoleKey, roles: RolePermissionMap) {
  if (role === SUPER_ADMIN && actor.role !== SUPER_ADMIN) {
    throw forbidden('Only a Super Admin can assign the Super Admin role.', 'PROTECTED_ROLE');
  }
  if (!holdsAll(actor, roles[role])) {
    throw forbidden(
      'You cannot assign a role with more access than your own.',
      'PRIVILEGE_ESCALATION',
    );
  }
}

/**
 * Runs inside the transaction after the change. Bumping the Super Admin role document makes two
 * concurrent demotions conflict, so they cannot both pass the count check (write skew).
 */
async function assertSuperAdminRemains(session: ClientSession) {
  await RoleModel.updateOne(
    { key: SUPER_ADMIN },
    {
      $inc: { version: 1 },
      $setOnInsert: {
        name: DEFAULT_ROLES.super_admin.name,
        description: DEFAULT_ROLES.super_admin.description,
      },
    },
    { upsert: true, session },
  );
  const remaining = await UserModel.countDocuments({ role: SUPER_ADMIN, isActive: true }).session(
    session,
  );
  if (remaining === 0) {
    throw new HttpError(409, 'At least one active Super Admin must remain.', 'LAST_SUPER_ADMIN');
  }
}

async function findTarget(id: string, session: ClientSession): Promise<UserDoc> {
  const doc = await UserModel.findById(id).session(session).lean<UserDoc>();
  if (!doc) throw notFound();
  return doc;
}

async function assertEmailFree(email: string, excludeId?: string, session?: ClientSession) {
  const filter = excludeId ? { email, _id: { $ne: excludeId } } : { email };
  if (await UserModel.exists(filter).session(session ?? null)) {
    throw new HttpError(409, 'A user with this email already exists.', 'EMAIL_TAKEN');
  }
}

async function getView(id: string) {
  const [doc, roles] = await Promise.all([
    UserModel.findById(id).lean<UserDoc>(),
    loadRolePermissions(),
  ]);
  if (!doc) throw notFound();
  return toView(doc, roles);
}

export const usersService = {
  async list(query: ListUsersQuery) {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.isActive = query.status === 'active';
    if (query.q) {
      const rx = new RegExp(escapeRegExp(query.q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const [docs, total, roles] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<UserDoc[]>(),
      UserModel.countDocuments(filter),
      loadRolePermissions(),
    ]);
    return {
      items: docs.map((d) => toView(d, roles)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  },

  get: getView,

  async create(actor: PublicUser, input: CreateUserInput) {
    const roles = await loadRolePermissions();
    if (input.role !== FALLBACK_ROLE && !actor.permissions.includes('roles.assign')) {
      throw forbidden('You need permission to assign roles to create this user.', 'FORBIDDEN');
    }
    assertCanAssignRole(actor, input.role, roles);
    await assertEmailFree(input.email);
    const passwordHash = await hashPassword(input.password);

    const id = await mongoose.connection.transaction(async (session) => {
      const [doc] = await UserModel.create(
        [{ name: input.name, email: input.email, passwordHash, role: input.role }],
        { session },
      );
      if (!doc) throw new Error('User was not created.');
      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.create',
          targetType: 'user',
          targetId: doc.id,
          details: { email: input.email, role: input.role },
        },
        session,
      );
      return doc.id;
    });
    return getView(id);
  },

  async update(actor: PublicUser, id: string, input: UpdateUserInput) {
    await mongoose.connection.transaction(async (session) => {
      const target = await findTarget(id, session);
      assertCanManage(actor, target);
      const changes: Record<string, string> = {};
      if (input.name !== undefined && input.name !== target.name) changes.name = input.name;
      if (input.email !== undefined && input.email !== target.email) {
        await assertEmailFree(input.email, id, session);
        changes.email = input.email;
      }
      if (Object.keys(changes).length === 0) return;
      await UserModel.updateOne({ _id: id }, { $set: changes }, { session });
      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.update',
          targetType: 'user',
          targetId: id,
          details: { changed: Object.keys(changes) },
        },
        session,
      );
    });
    return getView(id);
  },

  async changeRole(actor: PublicUser, id: string, role: RoleKey) {
    const roles = await loadRolePermissions();
    assertCanAssignRole(actor, role, roles);
    await mongoose.connection.transaction(async (session) => {
      const target = await findTarget(id, session);
      assertCanManage(actor, target);
      const from = roleOf(target);
      if (from === role) return;
      await UserModel.updateOne({ _id: id }, { $set: { role } }, { session });
      if (from === SUPER_ADMIN) await assertSuperAdminRemains(session);
      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.role.change',
          targetType: 'user',
          targetId: id,
          details: { from, to: role },
        },
        session,
      );
    });
    return getView(id);
  },

  async setStatus(actor: PublicUser, id: string, isActive: boolean) {
    const changed = await mongoose.connection.transaction(async (session) => {
      const target = await findTarget(id, session);
      assertCanManage(actor, target);
      if (target.isActive === isActive) return false;
      await UserModel.updateOne({ _id: id }, { $set: { isActive } }, { session });
      if (!isActive && roleOf(target) === SUPER_ADMIN) await assertSuperAdminRemains(session);
      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.status.change',
          targetType: 'user',
          targetId: id,
          details: { isActive },
        },
        session,
      );
      return true;
    });
    // After commit. Even if this fails, authenticate() already rejects inactive users.
    if (changed && !isActive) await sessions.revokeAllForUser(id);
    return getView(id);
  },

  async setPermissions(actor: PublicUser, id: string, input: UpdatePermissionsInput) {
    const grants: Permission[] = [...new Set(input.grants)];
    const revokes: Permission[] = [...new Set(input.revokes)];
    if (grants.some((p) => revokes.includes(p))) {
      throw new HttpError(
        400,
        'A permission cannot be both granted and revoked.',
        'PERMISSION_CONFLICT',
      );
    }
    if (!holdsAll(actor, grants)) {
      throw forbidden('You cannot grant permissions you do not have.', 'PRIVILEGE_ESCALATION');
    }
    await mongoose.connection.transaction(async (session) => {
      const target = await findTarget(id, session);
      assertCanManage(actor, target);
      if (roleOf(target) === SUPER_ADMIN) {
        throw new HttpError(
          400,
          'Super Admins always have every permission, so individual changes do not apply.',
          'PROTECTED_USER',
        );
      }
      await UserModel.updateOne({ _id: id }, { $set: { grants, revokes } }, { session });
      await recordAudit(
        {
          actorId: actor.id,
          action: 'user.permissions.change',
          targetType: 'user',
          targetId: id,
          details: {
            before: { grants: target.grants ?? [], revokes: target.revokes ?? [] },
            after: { grants, revokes },
          },
        },
        session,
      );
    });
    return getView(id);
  },
};

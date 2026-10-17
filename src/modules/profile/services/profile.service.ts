import type { PublicUser } from '../../../core/auth/types/index.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { DEFAULT_ROLES } from '../../access/permissions.js';
import { UserModel } from '../../users/models/user.model.js';

/** The signed-in user's own account: identity, role, effective permissions and history. */
export async function getProfile(user: PublicUser) {
  const doc = await UserModel.findById(user.id)
    .select('name email lastLoginAt createdAt')
    .lean<{ name: string; email: string; lastLoginAt?: Date | null; createdAt: Date }>();
  if (!doc) throw new HttpError(401, 'Session has been revoked.', 'SESSION_REVOKED');
  return {
    id: user.id,
    name: doc.name,
    email: doc.email,
    role: user.role,
    roleName: DEFAULT_ROLES[user.role].name,
    permissions: user.permissions,
    lastLoginAt: doc.lastLoginAt ?? null,
    createdAt: doc.createdAt,
  };
}

export async function updateProfile(user: PublicUser, name: string) {
  await UserModel.updateOne({ _id: user.id }, { $set: { name } });
  return getProfile({ ...user, name });
}

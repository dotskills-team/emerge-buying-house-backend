import { ResetTokenModel } from '../core/auth/models/reset-token.model.js';
import { RoleModel } from '../modules/access/models/role.model.js';
import { DEFAULT_ROLES, ROLE_KEYS, SUPER_ADMIN } from '../modules/access/permissions.js';
import { AuditLogModel } from '../modules/audit/models/audit-log.model.js';
import { UserModel } from '../modules/users/models/user.model.js';
import type { Migration } from './index.js';

/**
 * Introduces roles and permissions. Additive only: it never deletes or rewrites existing data.
 * Before this release every signed-in user could do everything, so existing accounts keep that
 * access as Super Admins; new accounts get an explicit role from then on.
 */
export const accessControl: Migration = {
  id: '001-access-control',
  description: 'Seed role definitions, give existing users the Super Admin role, add indexes',

  async up() {
    for (const key of ROLE_KEYS) {
      const { name, description, permissions } = DEFAULT_ROLES[key];
      // $setOnInsert: re-running never overwrites permissions a Super Admin has since changed.
      await RoleModel.updateOne(
        { key },
        { $setOnInsert: { key, name, description, permissions, version: 0 } },
        { upsert: true },
      );
    }
    const promoted = await UserModel.updateMany(
      { role: { $exists: false } },
      { $set: { role: SUPER_ADMIN } },
    );
    await UserModel.updateMany({ grants: { $exists: false } }, { $set: { grants: [] } });
    await UserModel.updateMany({ revokes: { $exists: false } }, { $set: { revokes: [] } });
    console.log(`  existing users given the Super Admin role: ${promoted.modifiedCount}`);

    await Promise.all([
      UserModel.createIndexes(),
      RoleModel.createIndexes(),
      ResetTokenModel.createIndexes(),
      AuditLogModel.createIndexes(),
    ]);
  },

  /** Removes only what `up` added. Audit entries and reset tokens are kept: they are history. */
  async down() {
    await UserModel.updateMany({}, { $unset: { role: '', grants: '', revokes: '' } });
    await RoleModel.deleteMany({});
  },
};

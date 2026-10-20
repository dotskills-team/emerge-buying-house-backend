import { RoleModel } from '../modules/access/models/role.model.js';
import { DEFAULT_ROLES, INQUIRIES_FULL } from '../modules/access/permissions.js';
import { InquiryModel } from '../modules/inquiries/models/inquiry.model.js';
import type { Migration } from './index.js';

/**
 * Introduces contact form inquiries. Additive only: Admins get the inquiry permissions (Super
 * Admin always has everything; other roles can be given them on the Roles page), and the
 * indexes are created.
 */
export const inquiries: Migration = {
  id: '003-inquiries',
  description: 'Add inquiry permissions to the Admin role and create inquiry indexes',

  async up() {
    await RoleModel.updateOne(
      { key: 'admin' },
      {
        $addToSet: { permissions: { $each: [...INQUIRIES_FULL] } },
        $set: { description: DEFAULT_ROLES.admin.description },
        $inc: { version: 1 },
      },
    );
    await InquiryModel.createIndexes();
  },

  /** Removes the inquiry permissions from every role. Inquiries are kept. */
  async down() {
    await RoleModel.updateMany(
      {},
      { $pull: { permissions: { $in: [...INQUIRIES_FULL] } }, $inc: { version: 1 } },
    );
  },
};

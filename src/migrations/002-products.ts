import { RoleModel } from '../modules/access/models/role.model.js';
import {
  DEFAULT_ROLES,
  PRODUCTS_FULL,
  type Permission,
  type RoleKey,
} from '../modules/access/permissions.js';
import { ProductCategoryModel } from '../modules/products/models/product-category.model.js';
import { ProductModel } from '../modules/products/models/product.model.js';
import type { Migration } from './index.js';

/** Which stored roles receive which product permissions (Super Admin always has everything). */
const GRANTS: Partial<Record<RoleKey, readonly Permission[]>> = {
  admin: PRODUCTS_FULL,
  content_manager: PRODUCTS_FULL,
  viewer: ['products.read'],
};

/**
 * Introduces the product catalogue. Additive only: it adds the new product permissions to the
 * standard roles (keeping any other changes a Super Admin made to them) and creates the indexes.
 */
export const products: Migration = {
  id: '002-products',
  description: 'Add product permissions to the standard roles and create product indexes',

  async up() {
    for (const [key, permissions] of Object.entries(GRANTS) as [RoleKey, Permission[]][]) {
      await RoleModel.updateOne(
        { key },
        {
          $addToSet: { permissions: { $each: [...permissions] } },
          $set: { description: DEFAULT_ROLES[key].description },
          $inc: { version: 1 },
        },
      );
    }
    await Promise.all([ProductModel.createIndexes(), ProductCategoryModel.createIndexes()]);
  },

  /** Removes the product permissions from every role. Product data is kept. */
  async down() {
    await RoleModel.updateMany(
      {},
      { $pull: { permissions: { $in: [...PRODUCTS_FULL] } }, $inc: { version: 1 } },
    );
  },
};

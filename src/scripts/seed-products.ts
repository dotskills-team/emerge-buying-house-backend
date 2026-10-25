import { parseArgs } from 'node:util';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { SUPER_ADMIN } from '../modules/access/permissions.js';
import {
  removeDemoProducts,
  seedDemoProducts,
} from '../modules/products/services/demo-seed.service.js';
import { UserModel } from '../modules/users/models/user.model.js';

// Demo catalogue (modules/products/demo-products.ts):
//   npm run seed:products              add the demo products that are missing
//   npm run seed:products -- --remove  delete them again (real products are never touched)
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { remove: { type: 'boolean' } } });
  await connectDatabase();
  try {
    if (values.remove) {
      const { products, categories } = await removeDemoProducts();
      console.log(`Removed ${products} demo products and ${categories} empty demo categories.`);
      return;
    }
    const author = await UserModel.findOne({ role: SUPER_ADMIN, isActive: true })
      .sort({ createdAt: 1 })
      .lean();
    if (!author) {
      console.error('No Super Admin found. Create one first with `npm run seed:admin`.');
      process.exitCode = 1;
      return;
    }
    const { created, skipped } = await seedDemoProducts(String(author._id));
    console.log(`Demo products: ${created} added, ${skipped} already there.`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

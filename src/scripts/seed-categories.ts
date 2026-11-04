import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { CATALOGUE_CATEGORIES } from '../modules/products/catalogue-categories.js';
import { ProductCategoryModel } from '../modules/products/models/product-category.model.js';

// The client's product categories (modules/products/catalogue-categories.ts):
//   npm run seed:categories   add the ones that are missing; existing ones are left as they are
async function main(): Promise<void> {
  await connectDatabase();
  try {
    let added = 0;
    for (const [i, c] of CATALOGUE_CATEGORIES.entries()) {
      const res = await ProductCategoryModel.updateOne(
        { slug: c.slug },
        { $setOnInsert: { name: c.name, slug: c.slug, description: c.description, sortOrder: i } },
        { upsert: true },
      );
      if (res.upsertedCount) added += 1;
    }
    console.log(
      `Categories: ${added} added, ${CATALOGUE_CATEGORIES.length - added} already there.`,
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

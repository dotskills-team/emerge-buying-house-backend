import type { Types } from 'mongoose';
import { sanitizeContent } from '../../blog/utils/blog.utils.js';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../demo-products.js';
import { ProductCategoryModel } from '../models/product-category.model.js';
import { ProductModel } from '../models/product.model.js';
import { createProductSchema } from '../validators/product.validator.js';

/**
 * Adds the demo categories and products that are missing (matched by slug), published, in the
 * listed order. Existing products are never changed, so running it again is safe. Each product
 * passes the same validation as one saved from the dashboard.
 */
export async function seedDemoProducts(authorId: string) {
  const categoryIds = new Map<string, Types.ObjectId>();
  for (const [i, c] of DEMO_CATEGORIES.entries()) {
    const doc = await ProductCategoryModel.findOneAndUpdate(
      { slug: c.slug },
      { $setOnInsert: { name: c.name, slug: c.slug, description: c.description, sortOrder: i } },
      { upsert: true, returnDocument: 'after' },
    );
    if (doc) categoryIds.set(c.slug, doc._id);
  }

  let created = 0;
  const now = Date.now();
  for (const [i, p] of DEMO_PRODUCTS.entries()) {
    if (await ProductModel.exists({ slug: p.slug })) continue;
    const { category, slug, ...fields } = p;
    const valid = createProductSchema.parse({ ...fields, slug, sortOrder: i * 10 });
    await ProductModel.create({
      ...valid,
      slug,
      category: categoryIds.get(category) ?? null,
      description: sanitizeContent(valid.description ?? ''),
      status: 'published',
      // Newest first in "latest" lists, in the listed order.
      publishedAt: new Date(now - i * 60_000),
      createdBy: authorId,
      updatedBy: authorId,
    });
    created += 1;
  }
  return { created, skipped: DEMO_PRODUCTS.length - created };
}

/** Deletes the demo products, and the demo categories that no longer hold any product. */
export async function removeDemoProducts() {
  const { deletedCount } = await ProductModel.deleteMany({
    slug: { $in: DEMO_PRODUCTS.map((p) => p.slug) },
  });
  let categories = 0;
  for (const c of DEMO_CATEGORIES) {
    const doc = await ProductCategoryModel.findOne({ slug: c.slug }).select('_id').lean();
    if (doc && !(await ProductModel.exists({ category: doc._id }))) {
      await ProductCategoryModel.deleteOne({ _id: doc._id });
      categories += 1;
    }
  }
  return { products: deletedCount, categories };
}

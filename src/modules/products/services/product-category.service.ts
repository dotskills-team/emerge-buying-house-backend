import { HttpError } from '../../../middleware/error.middleware.js';
import { slugify } from '../../blog/utils/blog.utils.js';
import { ProductCategoryModel } from '../models/product-category.model.js';
import { ProductModel } from '../models/product.model.js';
import { liveProductFilter, productRepository } from '../repositories/product.repository.js';
import type {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
} from '../validators/product.validator.js';

const notFound = () => new HttpError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');

async function assertSlugFree(slug: string, excludeId?: string) {
  const filter = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
  if (await ProductCategoryModel.exists(filter)) {
    throw new HttpError(409, 'A category with this name already exists.', 'CATEGORY_EXISTS');
  }
}

export const productCategoryService = {
  list() {
    return ProductCategoryModel.find().sort({ sortOrder: 1, name: 1 }).exec();
  },

  /** Each category with its number of live products (public) or of all products (admin). */
  async listWithCounts(scope: 'public' | 'admin') {
    const filter = scope === 'public' ? liveProductFilter() : { deletedAt: null };
    const [categories, counts] = await Promise.all([
      this.list(),
      productRepository.categoryCounts(filter),
    ]);
    return categories.map((c) => ({
      ...c.toJSON(),
      productCount: counts.get(String(c._id)) ?? 0,
    }));
  },

  async create(input: CreateProductCategoryInput) {
    const slug = slugify(input.slug || input.name);
    if (!slug) throw new HttpError(400, 'Enter a valid category name.', 'INVALID_SLUG');
    await assertSlugFree(slug);
    return ProductCategoryModel.create({
      name: input.name,
      slug,
      description: input.description ?? '',
      sortOrder: input.sortOrder ?? 0,
    });
  },

  async update(id: string, input: UpdateProductCategoryInput) {
    const category = await ProductCategoryModel.findById(id);
    if (!category) throw notFound();

    if (input.name !== undefined) category.name = input.name;
    if (input.description !== undefined) category.description = input.description;
    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
    if (input.slug !== undefined) {
      const slug = slugify(input.slug);
      if (!slug) throw new HttpError(400, 'Enter a valid slug.', 'INVALID_SLUG');
      if (slug !== category.slug) {
        await assertSlugFree(slug, id);
        category.slug = slug;
      }
    }
    return category.save();
  },

  async remove(id: string) {
    const inUse = await ProductModel.countDocuments({ category: id });
    if (inUse > 0) {
      throw new HttpError(
        409,
        `This category is used by ${inUse} ${inUse === 1 ? 'product' : 'products'} (including any in the trash). Move them to another category first.`,
        'CATEGORY_IN_USE',
      );
    }
    const res = await ProductCategoryModel.deleteOne({ _id: id });
    if (res.deletedCount === 0) throw notFound();
  },

  async findIdBySlug(slug: string): Promise<string | null> {
    const doc = await ProductCategoryModel.findOne({ slug }).select('_id').lean();
    return doc ? String(doc._id) : null;
  },
};

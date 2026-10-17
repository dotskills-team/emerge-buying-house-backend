import { HttpError } from '../../../middleware/error.middleware.js';
import { CategoryModel } from '../models/category.model.js';
import { PostModel } from '../models/post.model.js';
import { slugify } from '../utils/blog.utils.js';
import type { CreateCategoryInput, UpdateCategoryInput } from '../validators/blog.validator.js';

const notFound = () => new HttpError(404, 'Category not found.', 'CATEGORY_NOT_FOUND');

async function assertSlugFree(slug: string, excludeId?: string) {
  const filter = excludeId ? { slug, _id: { $ne: excludeId } } : { slug };
  if (await CategoryModel.exists(filter)) {
    throw new HttpError(409, 'A category with this name already exists.', 'CATEGORY_EXISTS');
  }
}

export const categoryService = {
  list() {
    return CategoryModel.find().sort({ name: 1 }).exec();
  },

  async create(input: CreateCategoryInput) {
    const slug = slugify(input.slug || input.name);
    if (!slug) throw new HttpError(400, 'Enter a valid category name.', 'INVALID_SLUG');
    await assertSlugFree(slug);
    return CategoryModel.create({ name: input.name, slug, description: input.description ?? '' });
  },

  async update(id: string, input: UpdateCategoryInput) {
    const category = await CategoryModel.findById(id);
    if (!category) throw notFound();

    if (input.name !== undefined) category.name = input.name;
    if (input.description !== undefined) category.description = input.description;
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
    const inUse = await PostModel.countDocuments({ category: id });
    if (inUse > 0) {
      throw new HttpError(
        409,
        `This category is used by ${inUse} ${inUse === 1 ? 'post' : 'posts'} (including any in the trash). Move them to another category first.`,
        'CATEGORY_IN_USE',
      );
    }
    const res = await CategoryModel.deleteOne({ _id: id });
    if (res.deletedCount === 0) throw notFound();
  },

  async findIdBySlug(slug: string): Promise<string | null> {
    const doc = await CategoryModel.findOne({ slug }).select('_id').lean();
    return doc ? String(doc._id) : null;
  },
};

import { Types, type QueryFilter } from 'mongoose';
import { cloudinary } from '../../../config/cloudinary.js';
import type { PublicUser } from '../../../core/auth/types/index.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { escapeRegExp } from '../../../utils/regex.js';
import { makeExcerpt, sanitizeContent, slugify } from '../../blog/utils/blog.utils.js';
import { ProductCategoryModel } from '../models/product-category.model.js';
import type { IProduct } from '../models/product.model.js';
import { liveProductFilter, productRepository } from '../repositories/product.repository.js';
import type {
  CreateProductInput,
  ListProductsQuery,
  PublicProductsQuery,
  UpdateProductInput,
} from '../validators/product.validator.js';
import { productCategoryService } from './product-category.service.js';

const notFound = () => new HttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');

const meta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Trims, drops empties and removes case-insensitive duplicates, keeping the first spelling. */
export function cleanList(values: string[] = [], lower = false): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = lower ? raw.trim().toLowerCase() : raw.trim();
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

const ADMIN_SORT = {
  order: { sortOrder: 1, createdAt: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
} as const;

// Featured first, then the editor's order, then newest.
const PUBLIC_SORT = { featured: -1, sortOrder: 1, publishedAt: -1 } as const;

/** Path segments the products router uses itself; a product slug must never shadow them. */
const RESERVED_SLUGS = new Set(['admin', 'categories']);
const safeSlug = (slug: string) => (RESERVED_SLUGS.has(slug) ? `${slug}-product` : slug);

async function uniqueSlug(source: string): Promise<string> {
  const base = safeSlug(slugify(source) || 'product');
  let candidate = base;
  for (let n = 2; await productRepository.slugTaken(candidate); n++) {
    if (n > 100) throw new HttpError(409, 'Could not generate a unique slug.', 'SLUG_CONFLICT');
    candidate = `${base}-${n}`;
  }
  return candidate;
}

async function assertCategory(id: string | null | undefined) {
  if (id && !(await ProductCategoryModel.exists({ _id: id }))) {
    throw new HttpError(400, 'The selected category does not exist.', 'CATEGORY_NOT_FOUND');
  }
}

async function getOrThrow(id: string, includeDeleted = false) {
  const product = await productRepository.findById(id, { includeDeleted });
  if (!product) throw notFound();
  return product;
}

/** Applies the fields present in `input` (PATCH semantics). */
function applyFields(product: Partial<IProduct>, input: UpdateProductInput) {
  if (input.name !== undefined) product.name = input.name;
  if (input.styleCode !== undefined) product.styleCode = input.styleCode;
  if (input.summary !== undefined) product.summary = input.summary;
  if (input.description !== undefined) product.description = sanitizeContent(input.description);
  if (input.images !== undefined) product.images = input.images;
  if (input.fabric !== undefined) product.fabric = input.fabric;
  if (input.weight !== undefined) product.weight = input.weight;
  if (input.sizes !== undefined) product.sizes = cleanList(input.sizes);
  if (input.colors !== undefined) product.colors = cleanList(input.colors);
  if (input.moq !== undefined) product.moq = input.moq;
  if (input.moqUnit !== undefined) product.moqUnit = input.moqUnit || 'pcs per style';
  if (input.leadTime !== undefined) product.leadTime = input.leadTime;
  if (input.certifications !== undefined) {
    product.certifications = cleanList(input.certifications);
  }
  if (input.specs !== undefined) product.specs = input.specs;
  if (input.tags !== undefined) product.tags = cleanList(input.tags, true);
  if (input.featured !== undefined) product.featured = input.featured;
  if (input.sortOrder !== undefined) product.sortOrder = input.sortOrder;
  if (input.seoTitle !== undefined) product.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) product.seoDescription = input.seoDescription;
  if (input.category !== undefined) {
    product.category = input.category ? new Types.ObjectId(input.category) : null;
  }
}

export const productService = {
  /* ---------- Admin ---------- */

  async listAdmin(query: ListProductsQuery) {
    const filter: QueryFilter<IProduct> = { deletedAt: query.trash ? { $ne: null } : null };
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = new Types.ObjectId(query.category);
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.q) {
      const rx = new RegExp(escapeRegExp(query.q), 'i');
      filter.$or = [{ name: rx }, { styleCode: rx }, { summary: rx }];
    }
    const { items, total } = await productRepository.list({
      filter,
      sort: { ...ADMIN_SORT[query.sort] },
      page: query.page,
      limit: query.limit,
    });
    return { items, meta: meta(query.page, query.limit, total) };
  },

  async stats() {
    const live = { deletedAt: null };
    const [all, published, draft, featured, trash] = await Promise.all([
      productRepository.count(live),
      productRepository.count({ ...live, status: 'published' }),
      productRepository.count({ ...live, status: 'draft' }),
      productRepository.count({ ...live, featured: true }),
      productRepository.count({ deletedAt: { $ne: null } }),
    ]);
    return { all, published, draft, featured, trash };
  },

  getAdmin(id: string) {
    return getOrThrow(id, true);
  },

  async create(actor: PublicUser, input: CreateProductInput) {
    await assertCategory(input.category);
    const product: Partial<IProduct> = {
      slug: await uniqueSlug(input.slug || input.name),
      status: 'draft',
      publishedAt: null,
      createdBy: new Types.ObjectId(actor.id),
      updatedBy: new Types.ObjectId(actor.id),
    };
    applyFields(product, input);
    if (!product.summary && product.description) product.summary = makeExcerpt(product.description);
    return productRepository.create(product);
  },

  async update(actor: PublicUser, id: string, input: UpdateProductInput) {
    const product = await getOrThrow(id);
    await assertCategory(input.category);

    if (input.slug !== undefined && input.slug !== product.slug) {
      const slug = safeSlug(slugify(input.slug));
      if (!slug) throw new HttpError(400, 'Enter a valid slug.', 'INVALID_SLUG');
      if (await productRepository.slugTaken(slug, id)) {
        throw new HttpError(409, 'This slug is already used by another product.', 'SLUG_TAKEN');
      }
      product.slug = slug;
    }
    applyFields(product, input);
    product.updatedBy = new Types.ObjectId(actor.id);
    return productRepository.save(product);
  },

  /** A product needs a category and a summary before buyers can see it. */
  async publish(actor: PublicUser, id: string) {
    const product = await getOrThrow(id);
    const missing = [!product.category && 'a category', !product.summary && 'a summary'].filter(
      Boolean,
    );
    if (missing.length) {
      throw new HttpError(
        400,
        `Add ${missing.join(' and ')} before publishing.`,
        'PUBLISH_REQUIREMENTS',
      );
    }
    product.status = 'published';
    product.publishedAt = product.publishedAt ?? new Date();
    product.updatedBy = new Types.ObjectId(actor.id);
    return productRepository.save(product);
  },

  async unpublish(actor: PublicUser, id: string) {
    const product = await getOrThrow(id);
    product.status = 'draft';
    product.updatedBy = new Types.ObjectId(actor.id);
    return productRepository.save(product);
  },

  /** A fresh draft with the same details. Images are shared, so the copy is not featured. */
  async duplicate(actor: PublicUser, id: string) {
    const source = await getOrThrow(id);
    const name = `${source.name} (copy)`.slice(0, 140);
    const raw = source.toObject();
    return productRepository.create({
      ...raw,
      _id: undefined,
      name,
      slug: await uniqueSlug(name),
      category: source.category?._id ?? null,
      // Image files belong to the original; the copy reuses them without owning them.
      images: raw.images.map(({ publicId: _owned, ...img }) => img),
      styleCode: source.styleCode ? `${source.styleCode}-COPY`.slice(0, 40) : '',
      status: 'draft',
      featured: false,
      publishedAt: null,
      createdBy: new Types.ObjectId(actor.id),
      updatedBy: new Types.ObjectId(actor.id),
      deletedAt: null,
      createdAt: undefined,
      updatedAt: undefined,
    } as Partial<IProduct>);
  },

  async remove(id: string) {
    const product = await getOrThrow(id);
    product.deletedAt = new Date();
    await productRepository.save(product);
  },

  /** Restored products come back as drafts so nothing goes live by accident. */
  async restore(id: string) {
    const product = await getOrThrow(id, true);
    if (!product.deletedAt) {
      throw new HttpError(409, 'This product is not in the trash.', 'NOT_IN_TRASH');
    }
    product.deletedAt = null;
    product.status = 'draft';
    return productRepository.save(product);
  },

  async purge(id: string) {
    const { deleted, imageIds } = await productRepository.purge(id);
    if (!deleted) {
      throw new HttpError(
        409,
        'Only products in the trash can be deleted permanently.',
        'NOT_IN_TRASH',
      );
    }
    // The product is already gone; a leftover image only costs storage, so log and continue.
    await Promise.all(
      imageIds.map((publicId) =>
        cloudinary.uploader.destroy(publicId).catch((err: unknown) => {
          console.error('Could not delete product image:', (err as Error).message);
        }),
      ),
    );
  },

  /* ---------- Public ---------- */

  async listPublic(query: PublicProductsQuery) {
    const filter: QueryFilter<IProduct> = liveProductFilter();
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.category) {
      const categoryId = await productCategoryService.findIdBySlug(query.category);
      if (!categoryId) return { items: [], meta: meta(query.page, query.limit, 0) };
      filter.category = new Types.ObjectId(categoryId);
    }
    if (query.q) {
      const rx = new RegExp(escapeRegExp(query.q), 'i');
      filter.$or = [{ name: rx }, { styleCode: rx }, { summary: rx }, { tags: rx }];
    }
    const { items, total } = await productRepository.list({
      filter,
      sort: { ...PUBLIC_SORT },
      page: query.page,
      limit: query.limit,
    });
    return { items, meta: meta(query.page, query.limit, total) };
  },

  async getPublicBySlug(slug: string) {
    const product = await productRepository.findLiveBySlug(slug.toLowerCase());
    if (!product) throw notFound();
    return product;
  },

  /** Same category first, topped up with other live products. */
  async related(slug: string, limit = 4) {
    const product = await productRepository.findLiveBySlug(slug.toLowerCase());
    if (!product) throw notFound();
    const others: QueryFilter<IProduct> = { ...liveProductFilter(), _id: { $ne: product._id } };
    const close = product.category
      ? (
          await productRepository.list({
            filter: { ...others, category: product.category._id },
            sort: { ...PUBLIC_SORT },
            page: 1,
            limit,
          })
        ).items
      : [];
    if (close.length >= limit) return close;
    const fill = await productRepository.list({
      filter: { ...others, _id: { $nin: [product._id, ...close.map((p) => p._id)] } },
      sort: { ...PUBLIC_SORT },
      page: 1,
      limit: limit - close.length,
    });
    return [...close, ...fill.items];
  },
};

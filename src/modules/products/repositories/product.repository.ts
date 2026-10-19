import type { PopulateOptions, QueryFilter, SortOrder } from 'mongoose';
import { ProductModel, type IProduct } from '../models/product.model.js';

const populate: PopulateOptions[] = [
  { path: 'category', select: 'name slug' },
  { path: 'createdBy', select: 'name' },
  { path: 'updatedBy', select: 'name' },
];

/** Published and not trashed: what the public site may show. */
export const liveProductFilter = (): QueryFilter<IProduct> => ({
  status: 'published',
  deletedAt: null,
});

export type ProductDocument = NonNullable<Awaited<ReturnType<typeof ProductModel.findOne>>>;

export interface ListParams {
  filter: QueryFilter<IProduct>;
  sort: Record<string, SortOrder>;
  page: number;
  limit: number;
}

export const productRepository = {
  async list({ filter, sort, page, limit }: ListParams) {
    const [items, total] = await Promise.all([
      ProductModel.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-description')
        .populate(populate)
        .exec(),
      ProductModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  count(filter: QueryFilter<IProduct>) {
    return ProductModel.countDocuments(filter).exec();
  },

  findById(id: string, opts: { includeDeleted?: boolean } = {}) {
    const filter: QueryFilter<IProduct> = { _id: id };
    if (!opts.includeDeleted) filter.deletedAt = null;
    return ProductModel.findOne(filter).populate(populate).exec();
  },

  findLiveBySlug(slug: string) {
    return ProductModel.findOne({ ...liveProductFilter(), slug })
      .populate(populate)
      .exec();
  },

  async slugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const filter: QueryFilter<IProduct> = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    return (await ProductModel.exists(filter)) !== null;
  },

  async create(data: Partial<IProduct>) {
    const doc = await ProductModel.create(data);
    return doc.populate(populate);
  },

  async save(doc: ProductDocument) {
    await doc.save();
    return doc.populate(populate);
  },

  /** Live product count per category id. */
  async categoryCounts(filter: QueryFilter<IProduct>) {
    const rows = await ProductModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { ...filter, category: { $ne: null } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [String(r._id), r.count]));
  },

  /**
   * Only removes products already in the trash. Returns the stored ids of its images that no
   * other product still shows (duplicates share image files), so they can be cleaned up.
   */
  async purge(id: string): Promise<{ deleted: boolean; imageIds: string[] }> {
    const doc = await ProductModel.findOneAndDelete({ _id: id, deletedAt: { $ne: null } })
      .select('images')
      .lean();
    if (!doc) return { deleted: false, imageIds: [] };
    const owned = doc.images.filter((i): i is typeof i & { publicId: string } => !!i.publicId);
    const stillUsed = await Promise.all(
      owned.map((i) => ProductModel.exists({ 'images.url': i.url })),
    );
    return {
      deleted: true,
      imageIds: owned.filter((_, n) => !stillUsed[n]).map((i) => i.publicId),
    };
  },
};

import { isValidObjectId, type PopulateOptions, type QueryFilter, type SortOrder } from 'mongoose';
import { PostModel, type IPost, type PostStatus } from '../models/post.model.js';

const populate: PopulateOptions[] = [
  { path: 'category', select: 'name slug' },
  { path: 'author', select: 'name' },
];

export interface ListParams {
  filter: QueryFilter<IPost>;
  sort: Record<string, SortOrder>;
  page: number;
  limit: number;
}

export type PostDocument = NonNullable<Awaited<ReturnType<typeof PostModel.findOne>>>;

export const postRepository = {
  async list({ filter, sort, page, limit }: ListParams) {
    const [items, total] = await Promise.all([
      PostModel.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-content')
        .populate(populate)
        .exec(),
      PostModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  findById(id: string, opts: { includeDeleted?: boolean } = {}) {
    const filter: QueryFilter<IPost> = { _id: id };
    if (!opts.includeDeleted) filter.deletedAt = null;
    return PostModel.findOne(filter).populate(populate).exec();
  },

  /** The fields authorization decisions need, without populating anything. */
  async findOwnership(
    id: string,
  ): Promise<{ authorId: string; status: PostStatus; deleted: boolean } | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await PostModel.findById(id).select('author status deletedAt').lean();
    return doc
      ? { authorId: String(doc.author), status: doc.status, deleted: doc.deletedAt !== null }
      : null;
  },

  findPublishedBySlug(slug: string) {
    return PostModel.findOne({
      slug,
      status: 'published',
      deletedAt: null,
      publishedAt: { $lte: new Date() },
    })
      .populate(populate)
      .exec();
  },

  async slugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const filter: QueryFilter<IPost> = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    return (await PostModel.exists(filter)) !== null;
  },

  async create(data: Partial<IPost>) {
    const doc = await PostModel.create(data);
    return doc.populate(populate);
  },

  async save(doc: PostDocument) {
    await doc.save();
    return doc.populate(populate);
  },

  /** Only removes posts already in the trash; returns the deleted post's cover image id. */
  async purge(id: string): Promise<{ deleted: boolean; coverPublicId?: string }> {
    const doc = await PostModel.findOneAndDelete({ _id: id, deletedAt: { $ne: null } })
      .select('coverImage')
      .lean();
    return { deleted: doc !== null, coverPublicId: doc?.coverImage?.publicId };
  },
};

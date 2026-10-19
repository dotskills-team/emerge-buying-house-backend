import { Types, type QueryFilter } from 'mongoose';
import { cloudinary } from '../../../config/cloudinary.js';
import type { PublicUser } from '../../../core/auth/types/index.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { escapeRegExp } from '../../../utils/regex.js';
import { CategoryModel } from '../models/category.model.js';
import type { IPost } from '../models/post.model.js';
import { liveFilter, postRepository } from '../repositories/post.repository.js';
import {
  makeExcerpt,
  normalizeTags,
  readingTimeMinutes,
  sanitizeContent,
  slugify,
  stripHtml,
} from '../utils/blog.utils.js';
import type {
  CreatePostInput,
  ListPostsQuery,
  PublicListQuery,
  PublishBody,
  UpdatePostInput,
} from '../validators/blog.validator.js';
import { categoryService } from './category.service.js';

const notFound = () => new HttpError(404, 'Post not found.', 'POST_NOT_FOUND');

const meta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** `posts.read` sees every post; anyone else (an Author) only sees their own. */
const canReadAll = (actor: PublicUser) => actor.permissions.includes('posts.read');

async function uniqueSlug(source: string): Promise<string> {
  const base = slugify(source) || 'post';
  let candidate = base;
  for (let n = 2; await postRepository.slugTaken(candidate); n++) {
    if (n > 100) throw new HttpError(409, 'Could not generate a unique slug.', 'SLUG_CONFLICT');
    candidate = `${base}-${n}`;
  }
  return candidate;
}

async function assertCategory(id: string | null | undefined) {
  if (id && !(await CategoryModel.exists({ _id: id }))) {
    throw new HttpError(400, 'The selected category does not exist.', 'CATEGORY_NOT_FOUND');
  }
}

async function assertCanRead(actor: PublicUser, id: string) {
  const owner = await postRepository.findOwnership(id);
  // Posts the actor may not see are reported as missing, so their existence is not revealed.
  if (!owner || (!canReadAll(actor) && owner.authorId !== actor.id)) throw notFound();
  return owner;
}

/** `posts.update` edits anything; `posts.create` alone (an Author) edits only their own drafts. */
async function assertCanEdit(actor: PublicUser, id: string) {
  const owner = await assertCanRead(actor, id);
  if (actor.permissions.includes('posts.update')) return;
  const ownDraft = owner.authorId === actor.id && owner.status === 'draft';
  if (!actor.permissions.includes('posts.create') || !ownDraft) {
    throw new HttpError(
      403,
      'You can only edit your own drafts. Ask an editor to change published posts.',
      'FORBIDDEN',
    );
  }
}

async function getOrThrow(id: string, includeDeleted = false) {
  const post = await postRepository.findById(id, { includeDeleted });
  if (!post) throw notFound();
  return post;
}

export const blogService = {
  /* ---------- Admin ---------- */

  async listAdmin(actor: PublicUser, query: ListPostsQuery) {
    const filter: QueryFilter<IPost> = { deletedAt: query.trash ? { $ne: null } : null };
    if (!canReadAll(actor)) filter.author = new Types.ObjectId(actor.id);
    if (query.status === 'draft') filter.status = 'draft';
    if (query.status === 'published' || query.status === 'scheduled') {
      filter.status = 'published';
      filter.publishedAt =
        query.status === 'published' ? { $lte: new Date() } : { $gt: new Date() };
    }
    if (query.category) filter.category = new Types.ObjectId(query.category);
    if (query.q) {
      const rx = new RegExp(escapeRegExp(query.q), 'i');
      filter.$or = [{ title: rx }, { excerpt: rx }];
    }
    const sort = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 },
    } as const;

    const { items, total } = await postRepository.list({
      filter,
      sort: { ...sort[query.sort] },
      page: query.page,
      limit: query.limit,
    });
    return { items, meta: meta(query.page, query.limit, total) };
  },

  /** Counts behind the status tabs, scoped like the list (an Author only counts their own). */
  async stats(actor: PublicUser) {
    const base: QueryFilter<IPost> = canReadAll(actor)
      ? {}
      : { author: new Types.ObjectId(actor.id) };
    const now = new Date();
    const live = { ...base, deletedAt: null };
    const [all, draft, published, scheduled, trash] = await Promise.all([
      postRepository.count(live),
      postRepository.count({ ...live, status: 'draft' }),
      postRepository.count({ ...live, status: 'published', publishedAt: { $lte: now } }),
      postRepository.count({ ...live, status: 'published', publishedAt: { $gt: now } }),
      postRepository.count({ ...base, deletedAt: { $ne: null } }),
    ]);
    return { all, draft, published, scheduled, trash };
  },

  /** A fresh draft with the same content, owned by whoever made the copy. */
  async duplicate(actor: PublicUser, id: string) {
    await assertCanRead(actor, id);
    const source = await getOrThrow(id);
    const title = `${source.title} (copy)`.slice(0, 160);
    return postRepository.create({
      title,
      slug: await uniqueSlug(title),
      excerpt: source.excerpt,
      content: source.content,
      coverImage: source.coverImage,
      category: source.category?._id ?? null,
      tags: source.tags,
      author: new Types.ObjectId(actor.id),
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      ogImage: source.ogImage,
      canonicalUrl: source.canonicalUrl,
      noIndex: source.noIndex,
      featured: false,
      readingTime: source.readingTime,
      status: 'draft',
      publishedAt: null,
    });
  },

  async getAdmin(actor: PublicUser, id: string) {
    await assertCanRead(actor, id);
    return getOrThrow(id, true);
  },

  async create(actor: PublicUser, input: CreatePostInput) {
    await assertCategory(input.category);
    const content = sanitizeContent(input.content ?? '');

    return postRepository.create({
      title: input.title,
      slug: await uniqueSlug(input.slug || input.title),
      content,
      excerpt: input.excerpt || makeExcerpt(content),
      coverImage: input.coverImage ?? null,
      category: input.category ? new Types.ObjectId(input.category) : null,
      tags: normalizeTags(input.tags),
      author: new Types.ObjectId(actor.id),
      seoTitle: input.seoTitle ?? '',
      seoDescription: input.seoDescription ?? '',
      ogImage: input.ogImage ?? null,
      canonicalUrl: input.canonicalUrl ?? null,
      noIndex: input.noIndex ?? false,
      featured: input.featured ?? false,
      readingTime: readingTimeMinutes(content),
      status: 'draft',
      publishedAt: null,
    });
  },

  async update(actor: PublicUser, id: string, input: UpdatePostInput) {
    await assertCanEdit(actor, id);
    const post = await getOrThrow(id);
    await assertCategory(input.category);

    if (input.slug !== undefined && input.slug !== post.slug) {
      const slug = slugify(input.slug);
      if (!slug) throw new HttpError(400, 'Enter a valid slug.', 'INVALID_SLUG');
      if (await postRepository.slugTaken(slug, id)) {
        throw new HttpError(409, 'This slug is already used by another post.', 'SLUG_TAKEN');
      }
      post.slug = slug;
    }
    if (input.title !== undefined) post.title = input.title;
    if (input.content !== undefined) {
      post.content = sanitizeContent(input.content);
      post.readingTime = readingTimeMinutes(post.content);
    }
    if (input.excerpt !== undefined) post.excerpt = input.excerpt;
    if (!post.excerpt) post.excerpt = makeExcerpt(post.content);
    if (input.coverImage !== undefined) post.coverImage = input.coverImage;
    if (input.category !== undefined) {
      post.category = input.category ? new Types.ObjectId(input.category) : null;
    }
    if (input.tags !== undefined) post.tags = normalizeTags(input.tags);
    if (input.seoTitle !== undefined) post.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) post.seoDescription = input.seoDescription;
    if (input.ogImage !== undefined) post.ogImage = input.ogImage;
    if (input.canonicalUrl !== undefined) post.canonicalUrl = input.canonicalUrl;
    if (input.noIndex !== undefined) post.noIndex = input.noIndex;
    if (input.featured !== undefined) post.featured = input.featured;

    return postRepository.save(post);
  },

  /**
   * Publishes now, or at `publishAt` (future = scheduled, past = backdated). Without a date a
   * re-published post keeps its original date, while a scheduled one goes live immediately.
   */
  async publish(id: string, { publishAt }: PublishBody = {}) {
    const post = await getOrThrow(id);
    if (!stripHtml(post.content)) {
      throw new HttpError(400, 'Add some content before publishing.', 'PUBLISH_REQUIREMENTS');
    }
    const now = new Date();
    post.status = 'published';
    post.publishedAt =
      publishAt ?? (post.publishedAt && post.publishedAt <= now ? post.publishedAt : now);
    return postRepository.save(post);
  },

  async unpublish(id: string) {
    const post = await getOrThrow(id);
    post.status = 'draft';
    return postRepository.save(post);
  },

  /** Soft delete: the post moves to trash and disappears from the public site. */
  async remove(id: string) {
    const post = await getOrThrow(id);
    post.deletedAt = new Date();
    await postRepository.save(post);
  },

  /** Restored posts come back as drafts so nothing goes live by accident. */
  async restore(id: string) {
    const post = await getOrThrow(id, true);
    if (!post.deletedAt) {
      throw new HttpError(409, 'This post is not in the trash.', 'NOT_IN_TRASH');
    }
    post.deletedAt = null;
    post.status = 'draft';
    return postRepository.save(post);
  },

  async purge(id: string) {
    const { deleted, coverPublicId } = await postRepository.purge(id);
    if (!deleted) {
      throw new HttpError(
        409,
        'Only posts in the trash can be deleted permanently.',
        'NOT_IN_TRASH',
      );
    }
    if (coverPublicId) {
      // The post is already gone; a leftover image only costs storage, so log and continue.
      await cloudinary.uploader.destroy(coverPublicId).catch((err: unknown) => {
        console.error('Could not delete cover image from Cloudinary:', (err as Error).message);
      });
    }
  },

  /* ---------- Public ---------- */

  async listPublic(query: PublicListQuery) {
    const filter: QueryFilter<IPost> = liveFilter();
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.exclude) filter.slug = { $ne: query.exclude.toLowerCase() };

    if (query.category) {
      const categoryId = await categoryService.findIdBySlug(query.category);
      if (!categoryId) return { items: [], meta: meta(query.page, query.limit, 0) };
      filter.category = new Types.ObjectId(categoryId);
    }
    if (query.tag) filter.tags = query.tag.toLowerCase();
    if (query.q) {
      const rx = new RegExp(escapeRegExp(query.q), 'i');
      filter.$or = [{ title: rx }, { excerpt: rx }];
    }

    const { items, total } = await postRepository.list({
      filter,
      sort: { publishedAt: -1 },
      page: query.page,
      limit: query.limit,
    });
    return { items, meta: meta(query.page, query.limit, total) };
  },

  async getPublicBySlug(slug: string) {
    const post = await postRepository.findPublishedBySlug(slug.toLowerCase());
    if (!post) throw notFound();
    return post;
  },

  /** Same category or shared tags first, topped up with the latest posts. */
  async related(slug: string, limit = 3) {
    const post = await postRepository.findPublishedBySlug(slug.toLowerCase());
    if (!post) throw notFound();
    const others: QueryFilter<IPost> = { ...liveFilter(), _id: { $ne: post._id } };
    const matches: QueryFilter<IPost>[] = [];
    if (post.category) matches.push({ category: post.category._id });
    if (post.tags.length) matches.push({ tags: { $in: post.tags } });

    const close = matches.length
      ? (
          await postRepository.list({
            filter: { ...others, $or: matches },
            sort: { publishedAt: -1 },
            page: 1,
            limit,
          })
        ).items
      : [];
    if (close.length >= limit) return close;
    const fill = await postRepository.list({
      filter: { ...others, _id: { $nin: [post._id, ...close.map((p) => p._id)] } },
      sort: { publishedAt: -1 },
      page: 1,
      limit: limit - close.length,
    });
    return [...close, ...fill.items];
  },

  /** Most used tags across live posts, for the blog sidebar. */
  popularTags(limit = 20) {
    return postRepository.tagCounts(liveFilter(), limit);
  },
};

import { Types, type QueryFilter } from 'mongoose';
import { cloudinary } from '../../../config/cloudinary.js';
import type { PublicUser } from '../../../core/auth/types/index.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { escapeRegExp } from '../../../utils/regex.js';
import { CategoryModel } from '../models/category.model.js';
import type { IPost } from '../models/post.model.js';
import { postRepository } from '../repositories/post.repository.js';
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
    if (query.status) filter.status = query.status;
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
    if (input.featured !== undefined) post.featured = input.featured;

    return postRepository.save(post);
  },

  async publish(id: string) {
    const post = await getOrThrow(id);
    if (!stripHtml(post.content)) {
      throw new HttpError(400, 'Add some content before publishing.', 'PUBLISH_REQUIREMENTS');
    }
    post.status = 'published';
    // Keep the original date when a post is re-published.
    post.publishedAt = post.publishedAt ?? new Date();
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
    const filter: QueryFilter<IPost> = {
      status: 'published',
      deletedAt: null,
      publishedAt: { $lte: new Date() },
    };

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
};

import { z } from 'zod';
import {
  blurDataUrlSchema,
  objectIdSchema,
  pageSchema,
} from '../../../validators/common.validator.js';
import { POST_STATUSES } from '../models/post.model.js';

const imageSchema = z.object({
  url: z.url(),
  publicId: z.string().max(300).optional(),
  alt: z.string().trim().max(200).default(''),
  blur: blurDataUrlSchema.optional(),
});

// No defaults here on purpose: defaults would overwrite stored values on PATCH.
const postFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  slug: z.string().trim().max(160),
  excerpt: z.string().trim().max(300),
  content: z.string().max(200_000),
  coverImage: imageSchema.nullable(),
  category: objectIdSchema.nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
  ogImage: z.url().nullable(),
  canonicalUrl: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .nullable(),
  noIndex: z.boolean(),
  featured: z.boolean(),
};

export const createPostSchema = z.object(postFields).partial().extend({ title: postFields.title });
export const updatePostSchema = z.object(postFields).partial();

/** Admin list filter. `scheduled` = published with a future date; `published` = live now. */
export const POST_FILTER_STATUSES = [...POST_STATUSES, 'scheduled'] as const;

export const listPostsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(POST_FILTER_STATUSES).optional(),
  category: objectIdSchema.optional(),
  trash: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  sort: z.enum(['newest', 'oldest', 'title']).default('newest'),
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** Optional publish date: a future date schedules the post; a past date backdates it. */
export const publishBodySchema = z
  .object({ publishAt: z.coerce.date().optional() })
  .optional()
  .transform((b) => b ?? {});

export const publicListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(), // category slug
  tag: z.string().trim().max(40).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  exclude: z.string().trim().max(200).optional(), // slug to leave out, e.g. the featured post
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(30).default(9),
});

const categoryFields = {
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(80),
  description: z.string().trim().max(300),
};
export const createCategorySchema = z
  .object(categoryFields)
  .partial()
  .extend({ name: categoryFields.name });
export const updateCategorySchema = z.object(categoryFields).partial();

export const slugParamSchema = z.object({ slug: z.string().trim().min(1).max(200) });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type PublicListQuery = z.infer<typeof publicListQuerySchema>;
export type PublishBody = z.infer<typeof publishBodySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

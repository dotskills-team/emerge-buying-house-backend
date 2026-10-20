import { z } from 'zod';
import {
  blurDataUrlSchema,
  objectIdSchema,
  pageSchema,
} from '../../../validators/common.validator.js';
import { PRODUCT_STATUSES } from '../models/product.model.js';

const shortText = (max: number) => z.string().trim().max(max);
const list = (itemMax: number, count: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(count);

export const MAX_PRODUCT_IMAGES = 12;

const imageSchema = z.object({
  url: z.url({ protocol: /^https$/ }).max(1000),
  publicId: z.string().max(300).optional(),
  alt: shortText(200).default(''),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  blur: blurDataUrlSchema.optional(),
});

const specSchema = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(160),
});

// No defaults here on purpose: defaults would overwrite stored values on PATCH.
const productFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(140),
  slug: shortText(160),
  styleCode: shortText(40),
  category: objectIdSchema.nullable(),
  summary: shortText(300),
  description: z.string().max(100_000),
  images: z.array(imageSchema).max(MAX_PRODUCT_IMAGES),
  fabric: shortText(160),
  weight: shortText(40),
  sizes: list(20, 20),
  colors: list(40, 30),
  moq: z.number().int().min(0).max(10_000_000).nullable(),
  moqUnit: shortText(40),
  leadTime: shortText(60),
  certifications: list(60, 12),
  specs: z.array(specSchema).max(20),
  tags: list(40, 15),
  featured: z.boolean(),
  sortOrder: z.number().int().min(-100_000).max(100_000),
  seoTitle: shortText(70),
  seoDescription: shortText(170),
};

export const createProductSchema = z
  .object(productFields)
  .partial()
  .extend({ name: productFields.name });
export const updateProductSchema = z.object(productFields).partial();

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  category: objectIdSchema.optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  trash: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  sort: z.enum(['order', 'newest', 'oldest', 'name']).default('order'),
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(60).default(12),
});

export const publicProductsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(), // category slug
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

const categoryFields = {
  name: z.string().trim().min(2).max(60),
  slug: shortText(80),
  description: shortText(300),
  sortOrder: z.number().int().min(-100_000).max(100_000),
};
export const createProductCategorySchema = z
  .object(categoryFields)
  .partial()
  .extend({ name: categoryFields.name });
export const updateProductCategorySchema = z.object(categoryFields).partial();

export const productSlugParamSchema = z.object({ slug: z.string().trim().min(1).max(200) });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type PublicProductsQuery = z.infer<typeof publicProductsQuerySchema>;
export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;

import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { cloudinary } from '../../../config/cloudinary.js';
import { env } from '../../../config/env.js';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import { ok } from '../../../lib/respond.js';
import { idParamSchema } from '../../../validators/common.validator.js';
import {
  requireAnyPermission,
  requirePermission,
} from '../../access/middlewares/require-permission.middleware.js';
import { blogService } from '../services/blog.service.js';
import { categoryService } from '../services/category.service.js';
import {
  createCategorySchema,
  createPostSchema,
  listPostsQuerySchema,
  publicListQuerySchema,
  publishBodySchema,
  slugParamSchema,
  updateCategorySchema,
  updatePostSchema,
} from '../validators/blog.validator.js';

const uploadSignatureSchema = z.object({
  folder: z.enum(['blog', 'products']).default('blog'),
});
const UPLOAD_FORMATS = 'jpg,jpeg,png,webp,avif';

export function createBlogRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  /* ---- Public ---- */
  router.get('/posts', async (req, res) => {
    ok(res, await blogService.listPublic(publicListQuerySchema.parse(req.query)));
  });
  router.get('/posts/:slug', async (req, res) => {
    ok(res, await blogService.getPublicBySlug(slugParamSchema.parse(req.params).slug));
  });
  router.get('/posts/:slug/related', async (req, res) => {
    ok(res, await blogService.related(slugParamSchema.parse(req.params).slug));
  });
  router.get('/categories', async (_req, res) => {
    ok(res, await categoryService.listWithCounts());
  });
  router.get('/tags', async (_req, res) => {
    ok(res, await blogService.popularTags());
  });

  /* ---- Admin ---- */
  const admin = Router();
  admin.use(requireAuth);
  const canSeePosts = requireAnyPermission('posts.read', 'posts.create');

  admin.get('/posts', canSeePosts, async (req, res) => {
    ok(res, await blogService.listAdmin(getAuth(res).user, listPostsQuerySchema.parse(req.query)));
  });
  // Registered before `/posts/:id` so "stats" is not read as an id.
  admin.get('/posts/stats', canSeePosts, async (_req, res) => {
    ok(res, await blogService.stats(getAuth(res).user));
  });
  admin.post('/posts', requirePermission('posts.create'), async (req, res) => {
    ok(res, await blogService.create(getAuth(res).user, createPostSchema.parse(req.body)), 201);
  });
  admin.post('/posts/:id/duplicate', requirePermission('posts.create'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await blogService.duplicate(getAuth(res).user, id), 201);
  });
  admin.get('/posts/:id', canSeePosts, async (req, res) => {
    ok(res, await blogService.getAdmin(getAuth(res).user, idParamSchema.parse(req.params).id));
  });
  admin.patch(
    '/posts/:id',
    requireAnyPermission('posts.update', 'posts.create'),
    async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      ok(res, await blogService.update(getAuth(res).user, id, updatePostSchema.parse(req.body)));
    },
  );
  admin.post('/posts/:id/publish', requirePermission('posts.publish'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await blogService.publish(id, publishBodySchema.parse(req.body)));
  });
  admin.post('/posts/:id/unpublish', requirePermission('posts.publish'), async (req, res) => {
    ok(res, await blogService.unpublish(idParamSchema.parse(req.params).id));
  });
  admin.delete('/posts/:id', requirePermission('posts.delete'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await blogService.remove(id);
    ok(res, { id });
  });
  admin.post('/posts/:id/restore', requirePermission('posts.delete'), async (req, res) => {
    ok(res, await blogService.restore(idParamSchema.parse(req.params).id));
  });
  admin.delete('/posts/:id/permanent', requirePermission('posts.delete'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await blogService.purge(id);
    ok(res, { id });
  });

  // Everyone who works with posts needs the category list to fill in the post form.
  admin.get(
    '/categories',
    requireAnyPermission('posts.read', 'posts.create', 'categories.manage'),
    async (_req, res) => {
      ok(res, await categoryService.list());
    },
  );
  admin.post('/categories', requirePermission('categories.manage'), async (req, res) => {
    ok(res, await categoryService.create(createCategorySchema.parse(req.body)), 201);
  });
  admin.patch('/categories/:id', requirePermission('categories.manage'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await categoryService.update(id, updateCategorySchema.parse(req.body)));
  });
  admin.delete('/categories/:id', requirePermission('categories.manage'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await categoryService.remove(id);
    ok(res, { id });
  });

  /**
   * Signed direct upload: the browser sends the file straight to Cloudinary, so images never pass
   * through this server and the API secret stays here. The signature pins folder and formats;
   * the folder is one of a fixed list (blog images or product images).
   */
  admin.post('/uploads/signature', requirePermission('media.upload'), (req, res) => {
    const { folder } = uploadSignatureSchema.parse(req.body ?? {});
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { timestamp, folder, allowed_formats: UPLOAD_FORMATS };
    ok(res, {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      ...params,
      signature: cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET),
    });
  });

  router.use('/admin', admin);
  return router;
}

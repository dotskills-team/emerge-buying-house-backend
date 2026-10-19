import { Router, type RequestHandler } from 'express';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import { ok } from '../../../lib/respond.js';
import { idParamSchema } from '../../../validators/common.validator.js';
import {
  requireAnyPermission,
  requirePermission,
} from '../../access/middlewares/require-permission.middleware.js';
import { productCategoryService } from '../services/product-category.service.js';
import { productService } from '../services/product.service.js';
import {
  createProductCategorySchema,
  createProductSchema,
  listProductsQuerySchema,
  productSlugParamSchema,
  publicProductsQuerySchema,
  updateProductCategorySchema,
  updateProductSchema,
} from '../validators/product.validator.js';

export function createProductsRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  /* ---- Public ---- */
  router.get('/', async (req, res) => {
    ok(res, await productService.listPublic(publicProductsQuerySchema.parse(req.query)));
  });
  router.get('/categories', async (_req, res) => {
    ok(res, await productCategoryService.listWithCounts('public'));
  });
  router.get('/:slug', async (req, res) => {
    ok(res, await productService.getPublicBySlug(productSlugParamSchema.parse(req.params).slug));
  });
  router.get('/:slug/related', async (req, res) => {
    ok(res, await productService.related(productSlugParamSchema.parse(req.params).slug));
  });

  /* ---- Admin ---- */
  const admin = Router();
  admin.use(requireAuth);
  const canSee = requireAnyPermission('products.read', 'products.manage');

  admin.get('/products', canSee, async (req, res) => {
    ok(res, await productService.listAdmin(listProductsQuerySchema.parse(req.query)));
  });
  // Registered before `/products/:id` so "stats" is not read as an id.
  admin.get('/products/stats', canSee, async (_req, res) => {
    ok(res, await productService.stats());
  });
  admin.post('/products', requirePermission('products.manage'), async (req, res) => {
    const input = createProductSchema.parse(req.body);
    ok(res, await productService.create(getAuth(res).user, input), 201);
  });
  admin.get('/products/:id', canSee, async (req, res) => {
    ok(res, await productService.getAdmin(idParamSchema.parse(req.params).id));
  });
  admin.patch('/products/:id', requirePermission('products.manage'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(
      res,
      await productService.update(getAuth(res).user, id, updateProductSchema.parse(req.body)),
    );
  });
  admin.post('/products/:id/duplicate', requirePermission('products.manage'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await productService.duplicate(getAuth(res).user, id), 201);
  });
  admin.post('/products/:id/publish', requirePermission('products.publish'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await productService.publish(getAuth(res).user, id));
  });
  admin.post('/products/:id/unpublish', requirePermission('products.publish'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await productService.unpublish(getAuth(res).user, id));
  });
  admin.delete('/products/:id', requirePermission('products.delete'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await productService.remove(id);
    ok(res, { id });
  });
  admin.post('/products/:id/restore', requirePermission('products.delete'), async (req, res) => {
    ok(res, await productService.restore(idParamSchema.parse(req.params).id));
  });
  admin.delete(
    '/products/:id/permanent',
    requirePermission('products.delete'),
    async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      await productService.purge(id);
      ok(res, { id });
    },
  );

  // Everyone who works with products needs the category list for the product form.
  admin.get(
    '/categories',
    requireAnyPermission('products.read', 'products.manage', 'products.categories'),
    async (_req, res) => {
      ok(res, await productCategoryService.listWithCounts('admin'));
    },
  );
  admin.post('/categories', requirePermission('products.categories'), async (req, res) => {
    ok(res, await productCategoryService.create(createProductCategorySchema.parse(req.body)), 201);
  });
  admin.patch('/categories/:id', requirePermission('products.categories'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await productCategoryService.update(id, updateProductCategorySchema.parse(req.body)));
  });
  admin.delete('/categories/:id', requirePermission('products.categories'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await productCategoryService.remove(id);
    ok(res, { id });
  });

  // Admin routes first, so "/admin/..." is never taken for a product slug.
  const root = Router();
  root.use('/admin', admin);
  root.use(router);
  return root;
}

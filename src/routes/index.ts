import { Router } from 'express';
import { createAuthRouter, type AuthRouterOptions } from '../core/auth/auth.routes.js';
import { createRequireAuth } from '../core/auth/middlewares/require-auth.middleware.js';
import type { AuthService } from '../core/auth/services/auth.service.js';
import type { PasswordService } from '../core/auth/services/password.service.js';
import type { AuthLimiters } from '../middleware/rate-limit.middleware.js';
import { createAccessRouter } from '../modules/access/routes/access.routes.js';
import { createAuditRouter } from '../modules/audit/routes/audit.routes.js';
import { createBlogRouter } from '../modules/blog/routes/blog.routes.js';
import { healthRouter } from '../modules/health/routes/health.routes.js';
import { createInquiriesRouter } from '../modules/inquiries/routes/inquiries.routes.js';
import type { InquiryService } from '../modules/inquiries/services/inquiry.service.js';
import { createProductsRouter } from '../modules/products/routes/products.routes.js';
import { createProfileRouter } from '../modules/profile/routes/profile.routes.js';
import { createUsersRouter } from '../modules/users/routes/users.routes.js';

export interface ApiRouterDeps {
  authService: AuthService;
  passwordService: PasswordService;
  limiters: AuthLimiters;
  authOptions: AuthRouterOptions;
  inquiryService: InquiryService;
}

export function createApiRouter(deps: ApiRouterDeps): Router {
  const requireAuth = createRequireAuth(deps.authService);
  const router = Router();

  router.use('/health', healthRouter);
  router.use(
    '/auth',
    createAuthRouter({
      authService: deps.authService,
      passwordService: deps.passwordService,
      limiters: deps.limiters,
      options: deps.authOptions,
    }),
  );
  router.use(
    '/profile',
    createProfileRouter({
      requireAuth,
      passwordService: deps.passwordService,
      passwordLimiter: deps.limiters.passwordChange,
    }),
  );
  router.use('/users', createUsersRouter(requireAuth));
  router.use('/audit-logs', createAuditRouter(requireAuth));
  router.use('/blog', createBlogRouter(requireAuth));
  router.use('/products', createProductsRouter(requireAuth));
  router.use(
    createInquiriesRouter({
      requireAuth,
      service: deps.inquiryService,
      contactLimiter: deps.limiters.contact,
    }),
  );
  router.use(createAccessRouter(requireAuth));

  return router;
}

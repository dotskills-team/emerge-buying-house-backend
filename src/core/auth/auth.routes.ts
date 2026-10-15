import { Router } from 'express';
import { createAuthController } from './controllers/auth.controller.js';
import { createRequireAuth } from './middlewares/require-auth.middleware.js';
import { createTrustedOrigin } from './middlewares/trusted-origin.middleware.js';
import type { AuthService } from './services/auth.service.js';

export interface AuthRouterOptions {
  secureCookies: boolean;
  clientOrigin: string;
}

export function createAuthRouter(authService: AuthService, options: AuthRouterOptions): Router {
  const router = Router();
  const controller = createAuthController(authService, options);

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(createTrustedOrigin(options.clientOrigin));

  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', createRequireAuth(authService), controller.me);

  return router;
}
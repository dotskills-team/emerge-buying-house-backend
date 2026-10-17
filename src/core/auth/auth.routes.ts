import { Router } from 'express';
import type { AuthLimiters } from '../../middleware/rate-limit.middleware.js';
import { createAuthController } from './controllers/auth.controller.js';
import { createRequireAuth } from './middlewares/require-auth.middleware.js';
import { createTrustedOrigin } from './middlewares/trusted-origin.middleware.js';
import type { AuthService } from './services/auth.service.js';
import type { PasswordService } from './services/password.service.js';

export interface AuthRouterOptions {
  secureCookies: boolean;
  clientOrigin: string;
}

export function createAuthRouter(deps: {
  authService: AuthService;
  passwordService: PasswordService;
  limiters: AuthLimiters;
  options: AuthRouterOptions;
}): Router {
  const { authService, passwordService, limiters, options } = deps;
  const router = Router();
  const controller = createAuthController(authService, passwordService, options);

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(createTrustedOrigin(options.clientOrigin));

  router.post('/login', limiters.login, controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', createRequireAuth(authService), controller.me);

  router.post('/forgot-password', limiters.passwordReset, controller.forgotPassword);
  router.post('/reset-password/verify', limiters.passwordReset, controller.verifyResetToken);
  router.post('/reset-password', limiters.passwordReset, controller.resetPassword);

  return router;
}

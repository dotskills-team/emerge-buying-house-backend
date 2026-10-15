import { Router } from 'express';
import { createAuthRouter, type AuthRouterOptions } from '../core/auth/auth.routes.js';
import type { AuthService } from '../core/auth/services/auth.service.js';
import { healthRouter } from './health.routes.js';

export interface ApiRouterDeps extends AuthRouterOptions {
  authService: AuthService;
}

export function createApiRouter({ authService, ...authOptions }: ApiRouterDeps): Router {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(authService, authOptions));
  return router;
}
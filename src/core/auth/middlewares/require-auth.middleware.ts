import type { RequestHandler } from 'express';
import { HttpError } from '../../../middleware/error.middleware.js';
import type { AuthService } from '../services/auth.service.js';

/** Verifies the Bearer access token and stores `{ user, familyId }` on `res.locals.auth`. */
export function createRequireAuth(authService: AuthService): RequestHandler {
  return async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      next(new HttpError(401, 'Authentication required.', 'ACCESS_TOKEN_MISSING'));
      return;
    }
    try {
      res.locals.auth = await authService.authenticate(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
import type { RequestHandler, Response } from 'express';
import { HttpError } from '../../../middleware/error.middleware.js';
import type { AuthService } from '../services/auth.service.js';
import type { AuthContext } from '../types/index.js';

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

/** Reads what require-auth stored. Throws 401 if a route forgot to mount require-auth. */
export function getAuth(res: Response): AuthContext {
  const auth = res.locals.auth;
  if (!auth) throw new HttpError(401, 'Authentication required.', 'ACCESS_TOKEN_MISSING');
  return auth;
}

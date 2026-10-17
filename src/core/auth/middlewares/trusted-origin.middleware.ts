import type { RequestHandler } from 'express';
import { HttpError } from '../../../middleware/error.middleware.js';

/**
 * Extra CSRF defence for cookie-authenticated endpoints (on top of SameSite=Strict):
 * a browser request carrying a foreign Origin header is rejected.
 */
export function createTrustedOrigin(allowedOrigin: string): RequestHandler {
  const expected = new URL(allowedOrigin).origin;
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== expected) {
      next(new HttpError(403, 'Request origin not allowed.', 'ORIGIN_NOT_ALLOWED'));
      return;
    }
    next();
  };
}

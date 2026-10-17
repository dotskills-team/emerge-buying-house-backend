import type { RequestHandler } from 'express';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import type { Permission } from '../permissions.js';

const forbidden = () => new HttpError(403, 'You do not have permission to do this.', 'FORBIDDEN');

/** Must run after require-auth. Passes only when the user holds every listed permission. */
export function requirePermission(...required: Permission[]): RequestHandler {
  return (_req, res, next) => {
    const { permissions } = getAuth(res).user;
    next(required.every((p) => permissions.includes(p)) ? undefined : forbidden());
  };
}

/** Passes when the user holds at least one of the listed permissions. */
export function requireAnyPermission(...options: Permission[]): RequestHandler {
  return (_req, res, next) => {
    const { permissions } = getAuth(res).user;
    next(options.some((p) => permissions.includes(p)) ? undefined : forbidden());
  };
}

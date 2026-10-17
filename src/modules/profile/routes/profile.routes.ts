import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import type { PasswordService } from '../../../core/auth/services/password.service.js';
import { changePasswordSchema } from '../../../core/auth/validators/auth.validator.js';
import { ok } from '../../../lib/respond.js';
import { requirePermission } from '../../access/middlewares/require-permission.middleware.js';
import { getProfile, updateProfile } from '../services/profile.service.js';

// Only fields a user may change about themselves. Role, permissions and status are not accepted.
const updateProfileSchema = z.strictObject({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
});

export function createProfileRouter(deps: {
  requireAuth: RequestHandler;
  passwordService: PasswordService;
  passwordLimiter: RequestHandler;
}): Router {
  const router = Router();
  router.use(deps.requireAuth);

  router.get('/', requirePermission('profile.read'), async (_req, res) => {
    ok(res, await getProfile(getAuth(res).user));
  });

  router.patch('/', requirePermission('profile.update'), async (req, res) => {
    const { name } = updateProfileSchema.parse(req.body);
    ok(res, await updateProfile(getAuth(res).user, name));
  });

  router.post(
    '/password',
    deps.passwordLimiter,
    requirePermission('auth.password.change'),
    async (req, res) => {
      const { user, familyId } = getAuth(res);
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      await deps.passwordService.changePassword({
        userId: user.id,
        currentPassword,
        newPassword,
        keepFamilyId: familyId,
      });
      ok(res, null);
    },
  );

  return router;
}

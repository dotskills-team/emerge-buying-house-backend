import { Router, type RequestHandler } from 'express';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import { ok } from '../../../lib/respond.js';
import { idParamSchema } from '../../../validators/common.validator.js';
import { requirePermission } from '../../access/middlewares/require-permission.middleware.js';
import { usersService } from '../services/users.service.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  updatePermissionsSchema,
  updateRoleSchema,
  updateStatusSchema,
  updateUserSchema,
} from '../validators/users.validator.js';

export function createUsersRouter(requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requirePermission('users.read'), async (req, res) => {
    ok(res, await usersService.list(listUsersQuerySchema.parse(req.query)));
  });

  router.post('/', requirePermission('users.create'), async (req, res) => {
    ok(res, await usersService.create(getAuth(res).user, createUserSchema.parse(req.body)), 201);
  });

  router.get('/:id', requirePermission('users.read'), async (req, res) => {
    ok(res, await usersService.get(idParamSchema.parse(req.params).id));
  });

  router.patch('/:id', requirePermission('users.update'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await usersService.update(getAuth(res).user, id, updateUserSchema.parse(req.body)));
  });

  router.patch('/:id/role', requirePermission('roles.assign'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { role } = updateRoleSchema.parse(req.body);
    ok(res, await usersService.changeRole(getAuth(res).user, id, role));
  });

  router.patch('/:id/status', requirePermission('users.status'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { isActive } = updateStatusSchema.parse(req.body);
    ok(res, await usersService.setStatus(getAuth(res).user, id, isActive));
  });

  router.put('/:id/permissions', requirePermission('permissions.assign'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updatePermissionsSchema.parse(req.body);
    ok(res, await usersService.setPermissions(getAuth(res).user, id, input));
  });

  return router;
}

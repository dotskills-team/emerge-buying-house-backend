import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import { ok } from '../../../lib/respond.js';
import { permissionSchema, roleSchema } from '../../../validators/common.validator.js';
import { requirePermission } from '../middlewares/require-permission.middleware.js';
import { listPermissions, listRoles, updateRolePermissions } from '../services/access.service.js';

const roleParamSchema = z.object({ key: roleSchema });
const rolePermissionsSchema = z.object({ permissions: z.array(permissionSchema).max(100) });

/** Mounted at /api: serves /roles and /permissions. */
export function createAccessRouter(requireAuth: RequestHandler): Router {
  const router = Router();

  router.get('/permissions', requireAuth, requirePermission('permissions.read'), (_req, res) => {
    ok(res, listPermissions());
  });

  router.get('/roles', requireAuth, requirePermission('roles.read'), async (_req, res) => {
    ok(res, await listRoles());
  });

  router.put(
    '/roles/:key/permissions',
    requireAuth,
    requirePermission('roles.manage'),
    async (req, res) => {
      const { key } = roleParamSchema.parse(req.params);
      const { permissions } = rolePermissionsSchema.parse(req.body);
      ok(res, await updateRolePermissions(getAuth(res).user, key, permissions));
    },
  );

  return router;
}

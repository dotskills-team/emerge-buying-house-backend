import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../../lib/respond.js';
import { pageSchema } from '../../../validators/common.validator.js';
import { requirePermission } from '../../access/middlewares/require-permission.middleware.js';
import { listAudit } from '../services/audit.service.js';

const querySchema = z.object({
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function createAuditRouter(requireAuth: RequestHandler): Router {
  const router = Router();
  router.get('/', requireAuth, requirePermission('audit.read'), async (req, res) => {
    ok(res, await listAudit(querySchema.parse(req.query)));
  });
  return router;
}

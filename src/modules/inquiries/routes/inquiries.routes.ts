import { Router, type RequestHandler } from 'express';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import { ok } from '../../../lib/respond.js';
import { idParamSchema } from '../../../validators/common.validator.js';
import { requirePermission } from '../../access/middlewares/require-permission.middleware.js';
import type { InquiryService } from '../services/inquiry.service.js';
import {
  listInquiriesQuerySchema,
  replyInquirySchema,
  submitInquirySchema,
  updateInquirySchema,
} from '../validators/inquiry.validator.js';

/** Mounted at /api: the public POST /contact, and /inquiries for the dashboard. */
export function createInquiriesRouter(deps: {
  requireAuth: RequestHandler;
  service: InquiryService;
  /** Limits how often one visitor can send the form. */
  contactLimiter: RequestHandler;
}): Router {
  const { requireAuth, service, contactLimiter } = deps;
  const router = Router();

  router.post('/contact', contactLimiter, async (req, res) => {
    ok(res, await service.submit(submitInquirySchema.parse(req.body)), 201);
  });

  const admin = Router();
  admin.use(requireAuth);
  const canRead = requirePermission('inquiries.read');
  const canManage = requirePermission('inquiries.manage');

  admin.get('/', canRead, async (req, res) => {
    ok(res, await service.list(listInquiriesQuerySchema.parse(req.query)));
  });
  // Registered before `/:id` so "stats" is not read as an id.
  admin.get('/stats', canRead, async (_req, res) => {
    ok(res, await service.stats());
  });
  admin.get('/:id', canRead, async (req, res) => {
    ok(res, await service.get(idParamSchema.parse(req.params).id));
  });
  admin.post('/:id/open', canManage, async (req, res) => {
    ok(res, await service.open(idParamSchema.parse(req.params).id));
  });
  admin.patch('/:id', canManage, async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await service.update(id, updateInquirySchema.parse(req.body)));
  });
  admin.post('/:id/reply', canManage, async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { message } = replyInquirySchema.parse(req.body);
    const { user } = getAuth(res);
    ok(res, await service.reply(id, { id: user.id, name: user.name }, message));
  });
  admin.delete('/:id', requirePermission('inquiries.delete'), async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await service.remove(id);
    ok(res, { id });
  });

  router.use('/inquiries', admin);
  return router;
}

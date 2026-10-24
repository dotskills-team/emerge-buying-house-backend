import { Router, type RequestHandler } from 'express';
import { getAuth } from '../../../core/auth/middlewares/require-auth.middleware.js';
import { ok } from '../../../lib/respond.js';
import { idParamSchema } from '../../../validators/common.validator.js';
import { requirePermission } from '../../access/middlewares/require-permission.middleware.js';
import { chatbotService } from '../services/chatbot.service.js';
import {
  askSchema,
  createAnswerSchema,
  feedbackSchema,
  testMatchSchema,
  unansweredQuerySchema,
  updateAnswerSchema,
  updateUnansweredSchema,
} from '../validators/chatbot.validator.js';

/** Mounted at /api/chatbot: the public chat, and /admin for the dashboard. */
export function createChatbotRouter(deps: {
  requireAuth: RequestHandler;
  /** Limits how fast one visitor can send chat messages and feedback. */
  chatLimiter: RequestHandler;
}): Router {
  const { requireAuth, chatLimiter } = deps;
  const router = Router();

  /* ---- Public ---- */
  router.get('/suggestions', async (_req, res) => {
    ok(res, await chatbotService.suggestions());
  });
  router.post('/ask', chatLimiter, async (req, res) => {
    ok(res, await chatbotService.ask(askSchema.parse(req.body)));
  });
  router.post('/answers/:id/feedback', chatLimiter, async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await chatbotService.feedback(id, feedbackSchema.parse(req.body).helpful);
    ok(res, { id });
  });

  /* ---- Dashboard ---- */
  const admin = Router();
  admin.use(requireAuth, requirePermission('chatbot.manage'));

  admin.get('/answers', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    ok(res, await chatbotService.list(q || undefined));
  });
  admin.get('/stats', async (_req, res) => {
    ok(res, await chatbotService.stats());
  });
  admin.post('/answers', async (req, res) => {
    ok(
      res,
      await chatbotService.create(getAuth(res).user, createAnswerSchema.parse(req.body)),
      201,
    );
  });
  admin.patch('/answers/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    ok(res, await chatbotService.update(getAuth(res).user, id, updateAnswerSchema.parse(req.body)));
  });
  admin.delete('/answers/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    await chatbotService.remove(id);
    ok(res, { id });
  });
  admin.get('/unanswered', async (req, res) => {
    ok(res, await chatbotService.unanswered(unansweredQuerySchema.parse(req.query).status));
  });
  admin.patch('/unanswered/:id', async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { status } = updateUnansweredSchema.parse(req.body);
    ok(res, await chatbotService.setUnansweredStatus(id, status));
  });
  admin.post('/test', async (req, res) => {
    ok(res, await chatbotService.test(testMatchSchema.parse(req.body).message));
  });

  router.use('/admin', admin);
  return router;
}

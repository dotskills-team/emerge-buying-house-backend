import { z } from 'zod';
import { objectIdSchema } from '../../../validators/common.validator.js';
import { UNANSWERED_STATUSES } from '../models/unanswered-question.model.js';

export const askSchema = z.union([
  z.object({
    message: z
      .string()
      .trim()
      .min(1, 'Type a question')
      .max(500, 'Keep the question under 500 characters'),
  }),
  // A suggested question the visitor clicked.
  z.object({ answerId: objectIdSchema }),
]);
export type AskInput = z.infer<typeof askSchema>;

export const feedbackSchema = z.object({ helpful: z.boolean() });

const keywords = z
  .array(z.string().trim().min(1).max(60))
  .max(20, 'Use at most 20 keywords')
  .transform((list) => [...new Map(list.map((k) => [k.toLowerCase(), k])).values()]);

// No defaults on purpose: defaults would overwrite stored values on PATCH.
const answerFields = {
  question: z.string().trim().min(5, 'Write the question visitors ask').max(200),
  answer: z.string().trim().min(2, 'Write the answer').max(2000),
  keywords,
  published: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
};

export const createAnswerSchema = z.object({
  ...answerFields,
  keywords: keywords.default([]),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  /** The unanswered question this answer was written for; it is marked resolved. */
  fromUnanswered: objectIdSchema.optional(),
});
export type CreateAnswerInput = z.infer<typeof createAnswerSchema>;

export const updateAnswerSchema = z.object(answerFields).partial();
export type UpdateAnswerInput = z.infer<typeof updateAnswerSchema>;

export const unansweredQuerySchema = z.object({
  status: z.enum(UNANSWERED_STATUSES).default('open'),
});

export const updateUnansweredSchema = z.object({
  status: z.enum(['open', 'dismissed']),
});

export const testMatchSchema = z.object({ message: z.string().trim().min(1).max(500) });

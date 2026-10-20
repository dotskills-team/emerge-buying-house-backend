import { z } from 'zod';
import { pageSchema } from '../../../validators/common.validator.js';
import { INQUIRY_STATUSES, INQUIRY_TOPICS } from '../models/inquiry.model.js';

/** One line of text: no line breaks, so it is safe in an email subject. */
const line = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .refine((v) => !/[\r\n]/.test(v), `${label} must be on one line`);

export const submitInquirySchema = z.object({
  name: line(100, 'Name').pipe(z.string().min(2, 'Enter your name')),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  company: line(120, 'Company').default(''),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === '' || /^\+?[\d\s().-]{6,40}$/.test(v), 'Enter a valid phone number')
    .default(''),
  country: line(80, 'Country').default(''),
  topic: z.enum(INQUIRY_TOPICS, 'Choose what your message is about'),
  product: line(140, 'Product').default(''),
  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little more (at least 10 characters)')
    .max(5000, 'Message must be 5,000 characters or fewer'),
  /** Honeypot: hidden from people, so only bots fill it in. */
  website: z.string().max(500).optional(),
});
export type SubmitInquiryInput = z.infer<typeof submitInquirySchema>;

export const listInquiriesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(INQUIRY_STATUSES).optional(),
  topic: z.enum(INQUIRY_TOPICS).optional(),
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListInquiriesQuery = z.infer<typeof listInquiriesQuerySchema>;

export const updateInquirySchema = z
  .object({
    status: z.enum(INQUIRY_STATUSES),
    note: z.string().trim().max(2000, 'Note must be 2,000 characters or fewer'),
  })
  .partial()
  .refine((v) => v.status !== undefined || v.note !== undefined, 'Nothing to update');
export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;

export const replyInquirySchema = z.object({
  message: z
    .string()
    .trim()
    .min(2, 'Write a reply first')
    .max(10_000, 'Reply must be 10,000 characters or fewer'),
});

import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { HttpError } from './error.middleware.js';

const emailOf = (req: Request): string => {
  const email: unknown = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
};

/**
 * Per-instance, in-memory limits. On Vercel each warm function instance counts separately, so
 * these slow down abuse rather than enforce an exact global cap (a shared store would be needed
 * for that). Keys combine IP and, where given, the target email, so many staff behind one office
 * IP do not block each other.
 */
export function createLimiter(options: {
  windowMs: number;
  limit: number;
  byEmail?: boolean;
  message: string;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ip = ipKeyGenerator(req.ip ?? 'unknown');
      return options.byEmail ? `${ip}|${emailOf(req)}` : ip;
    },
    handler: (_req, _res, next) => next(new HttpError(429, options.message, 'RATE_LIMITED')),
  });
}

const MINUTE = 60_000;

export const createAuthLimiters = () => ({
  login: createLimiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    byEmail: true,
    message: 'Too many sign-in attempts. Wait a few minutes and try again.',
  }),
  passwordReset: createLimiter({
    windowMs: 60 * MINUTE,
    limit: 5,
    byEmail: true,
    message: 'Too many password reset requests. Try again later.',
  }),
  passwordChange: createLimiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    message: 'Too many password attempts. Wait a few minutes and try again.',
  }),
});

export type AuthLimiters = ReturnType<typeof createAuthLimiters>;

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
};

/** Client errors raised by Express/body-parser (e.g. malformed JSON) carry a 4xx `status`. */
function clientErrorStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  const bodyParserStatus = clientErrorStatus(err);
  const statusCode = err instanceof HttpError ? err.statusCode : (bodyParserStatus ?? 500);
  const isProd = env.NODE_ENV === 'production';
  const message =
    statusCode === 500 && isProd
      ? 'Internal server error'
      : bodyParserStatus
        ? 'Invalid request body'
        : (err as Error).message;

  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(err instanceof HttpError && err.code ? { code: err.code } : {}),
    ...(!isProd && statusCode === 500 ? { stack: (err as Error).stack } : {}),
  });
};
import type { Response } from 'express';

/** The success envelope every endpoint uses: `{ success: true, data }`. */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

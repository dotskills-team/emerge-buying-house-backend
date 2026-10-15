import type { Request, Response } from 'express';
import { HttpError } from '../../../middleware/error.middleware.js';
import type { AuthService } from '../services/auth.service.js';
import type { AuthResult, RequestMeta } from '../types/index.js';
import { REFRESH_COOKIE, readCookie, refreshCookieOptions } from '../utils/cookies.js';
import { loginSchema } from '../validators/auth.validator.js';

export function createAuthController(authService: AuthService, opts: { secureCookies: boolean }) {
  const cookieOptions = refreshCookieOptions(opts.secureCookies);

  const metaOf = (req: Request): RequestMeta => ({
    userAgent: req.headers['user-agent']?.slice(0, 200),
  });

  const sendSession = (res: Response, result: AuthResult): void => {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...cookieOptions,
      expires: result.refreshExpiresAt,
    });
    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user },
    });
  };

  return {
    async login(req: Request, res: Response): Promise<void> {
      const { email, password } = loginSchema.parse(req.body);
      sendSession(res, await authService.login(email, password, metaOf(req)));
    },

    async refresh(req: Request, res: Response): Promise<void> {
      try {
        const token = readCookie(req.headers.cookie, REFRESH_COOKIE);
        sendSession(res, await authService.refresh(token, metaOf(req)));
      } catch (err) {
        // A dead session: drop the cookie. A race loser keeps it (the winner already replaced it).
        if (err instanceof HttpError && err.statusCode === 401 && err.code !== 'REFRESH_CONFLICT') {
          res.clearCookie(REFRESH_COOKIE, cookieOptions);
        }
        throw err;
      }
    },

    async logout(req: Request, res: Response): Promise<void> {
      await authService.logout(readCookie(req.headers.cookie, REFRESH_COOKIE));
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      res.status(200).json({ success: true, data: null });
    },

    me(_req: Request, res: Response): void {
      res.status(200).json({ success: true, data: { user: res.locals.auth.user } });
    },
  };
}
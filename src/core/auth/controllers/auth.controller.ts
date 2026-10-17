import type { Request, Response } from 'express';
import { ok } from '../../../lib/respond.js';
import { HttpError } from '../../../middleware/error.middleware.js';
import { getAuth } from '../middlewares/require-auth.middleware.js';
import type { AuthService } from '../services/auth.service.js';
import type { PasswordService } from '../services/password.service.js';
import type { AuthResult, RequestMeta } from '../types/index.js';
import { REFRESH_COOKIE, readCookie, refreshCookieOptions } from '../utils/cookies.js';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  verifyResetSchema,
} from '../validators/auth.validator.js';

const RESET_REQUESTED =
  'If an account exists for this email, we have sent a link to reset the password.';

export function createAuthController(
  authService: AuthService,
  passwordService: PasswordService,
  opts: { secureCookies: boolean },
) {
  const cookieOptions = refreshCookieOptions(opts.secureCookies);

  const metaOf = (req: Request): RequestMeta => ({
    userAgent: req.headers['user-agent']?.slice(0, 200),
  });

  const sendSession = (res: Response, result: AuthResult): void => {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...cookieOptions,
      expires: result.refreshExpiresAt,
    });
    ok(res, { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user });
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
      ok(res, null);
    },

    me(_req: Request, res: Response): void {
      ok(res, { user: getAuth(res).user });
    },

    async forgotPassword(req: Request, res: Response): Promise<void> {
      const { email } = forgotPasswordSchema.parse(req.body);
      await passwordService.requestReset(email);
      ok(res, { message: RESET_REQUESTED });
    },

    async verifyResetToken(req: Request, res: Response): Promise<void> {
      const { token } = verifyResetSchema.parse(req.body);
      await passwordService.verifyResetToken(token);
      ok(res, { valid: true });
    },

    async resetPassword(req: Request, res: Response): Promise<void> {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await passwordService.resetPassword(token, password);
      // Every session was revoked, including any on this browser.
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      ok(res, null);
    },
  };
}

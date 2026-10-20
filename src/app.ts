import express, { type RequestHandler } from 'express';
import cors from 'cors';
import * as helmetModule from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { createDefaultAuthServices } from './core/auth/auth.factory.js';
import type { AuthService } from './core/auth/services/auth.service.js';
import type { PasswordService } from './core/auth/services/password.service.js';
import { createResendMailer, type Mailer } from './lib/mailer.js';
import { createInquiryService } from './modules/inquiries/services/inquiry.service.js';
import { createApiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { createAuthLimiters, type AuthLimiters } from './middleware/rate-limit.middleware.js';

// Typed explicitly so it compiles the same in every module-resolution setup (local, Vercel, etc.).
type HelmetFn = (options?: Record<string, unknown>) => RequestHandler;
const helmet = ('default' in helmetModule
  ? helmetModule.default
  : helmetModule) as unknown as HelmetFn;

export interface AppDeps {
  authService: AuthService;
  passwordService: PasswordService;
  limiters?: AuthLimiters;
  /** Sends contact form emails. Defaults to Resend, configured from the environment. */
  mailer?: Mailer;
}

export function createApp(deps: AppDeps = createDefaultAuthServices()) {
  const app = express();

  app.disable('x-powered-by');
  // Vercel (and the frontend's rewrite proxy) sit in front of the app; trust one hop for req.ip.
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/api',
    createApiRouter({
      authService: deps.authService,
      passwordService: deps.passwordService,
      limiters: deps.limiters ?? createAuthLimiters(),
      authOptions: {
        secureCookies: env.NODE_ENV === 'production',
        clientOrigin: env.CLIENT_ORIGIN,
      },
      inquiryService: createInquiryService({
        mailer:
          deps.mailer ?? createResendMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }),
        config: {
          notifyTo: env.CONTACT_NOTIFY_EMAILS,
          replyTo: env.CONTACT_REPLY_TO,
          appName: env.APP_NAME,
          appUrl: new URL(env.CLIENT_ORIGIN).origin,
        },
      }),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import express from 'express';
import cors from 'cors';
import * as helmetModule from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

type HelmetFn = typeof helmetModule.default;
const helmet: HelmetFn =
  'default' in helmetModule ? helmetModule.default : (helmetModule as unknown as HelmetFn);

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
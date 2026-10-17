import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../../../lib/respond.js';

type DatabaseState = 'connected' | 'connecting' | 'disconnecting' | 'disconnected';

const DB_STATES: Record<number, DatabaseState> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  ok(res, {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: DB_STATES[mongoose.connection.readyState] ?? 'disconnected',
  });
});

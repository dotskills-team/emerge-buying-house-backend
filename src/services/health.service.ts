import mongoose from 'mongoose';
import type { HealthResponse } from '../types/index.js';

const DB_STATES: Record<number, HealthResponse['database']> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function getHealthStatus(): HealthResponse {
  return {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: DB_STATES[mongoose.connection.readyState] ?? 'disconnected',
  };
}

import mongoose from 'mongoose';
import { env } from './env.js';

let listenersAttached = false;
let connecting: Promise<unknown> | null = null;

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
}

/** Safe to call many times (e.g. on every serverless request): connects once and reuses it. */
export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  attachListeners();

  connecting ??= mongoose
    .connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, maxPoolSize: 5 })
    .catch((err: unknown) => {
      connecting = null; // allow a retry on the next request
      throw err;
    });

  await connecting;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

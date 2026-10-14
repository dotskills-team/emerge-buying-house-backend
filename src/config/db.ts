import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

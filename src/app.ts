import type { IncomingMessage, ServerResponse } from 'node:http';
import '../src/config/cloudinary.js';
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/db.js';

// Vercel entry point. The Express app is created once per warm function instance.
const app = createApp();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await connectDatabase();
  } catch (err) {
    // Keep serving (e.g. /api/health reports "disconnected") instead of crashing the function.
    console.error('MongoDB connection failed:', (err as Error).message);
  }
  app(req, res);
}
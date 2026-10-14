import { env } from './config/env.js';
import './config/cloudinary.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';

async function bootstrap(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  try {
    await connectDatabase();
  } catch (err) {
    console.error(
      'Initial MongoDB connection failed. API is running without a database:',
      (err as Error).message,
    );
  }

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void bootstrap();

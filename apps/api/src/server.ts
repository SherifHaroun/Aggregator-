import { API_BASE_PATH, createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}${API_BASE_PATH}`);
  if (!env.databaseUrl) {
    console.warn('DATABASE_URL is not set — database-backed endpoints are unavailable.');
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
  });
}

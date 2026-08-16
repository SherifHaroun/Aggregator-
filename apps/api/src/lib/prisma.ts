/**
 * Prisma client singleton.
 *
 * Lazily created so the API can start and serve configuration endpoints before
 * PostgreSQL is connected. Every module must obtain its client from here.
 */

import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

let client: PrismaClient | null = null;

export function isDatabaseConfigured(): boolean {
  return env.databaseUrl !== null;
}

export function getPrisma(): PrismaClient {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env.');
  }
  client ??= new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await client?.$disconnect();
  client = null;
}

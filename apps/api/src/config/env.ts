/**
 * Environment configuration.
 * Read process.env HERE and nowhere else, so every setting has one home.
 */

import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

const nodeEnv = optional('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(optional('PORT', '4000')),
  /** Origins allowed to call this API. */
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /**
   * Present only when the database is configured. The API boots without it so
   * the application can be developed before PostgreSQL is connected.
   */
  databaseUrl: process.env.DATABASE_URL ?? null,
  /** Where uploaded images (company logos) are written. */
  uploadDir: resolve(process.cwd(), optional('UPLOAD_DIR', 'uploads')),
  /** Public path those files are served from. */
  uploadPublicPath: '/uploads',
  /** Where the Vite dev server runs; shown when the API port is opened in a browser. */
  webDevServerUrl: optional('WEB_DEV_SERVER_URL', 'http://localhost:5173'),
  /**
   * Shared secret required to CHANGE insurance data. Unset on the current
   * internal-only deployment, which leaves writes open as they are today.
   * Set it once a public client can reach this API — see `middleware/access.ts`.
   */
  adminApiToken: process.env['ADMIN_API_TOKEN'] ?? null,
} as const;

// Created at boot so the first upload never fails on a missing directory.
mkdirSync(env.uploadDir, { recursive: true });

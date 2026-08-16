import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

/** API base path. Change here only. */
export const API_BASE_PATH = '/api/v1';

/**
 * The compiled React build.
 *
 * Resolved relative to this module, which lands on the same directory whether
 * the code runs from source (`apps/api/src/app.ts`, via tsx) or compiled
 * (`apps/api/dist/app.js`) — both are two levels below `apps/`.
 */
export const WEB_DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');

/**
 * Paths the single-page-app fallback must never answer for: the API and the
 * uploaded files. `(?:/|$)` keeps the exclusion to whole path segments, so a
 * future client route such as `/apiary` is still served the app.
 */
const NON_SPA_PATHS = /^(?!\/(?:api|uploads)(?:\/|$)).*/;

export function createApp(): Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProduction) {
    app.use(morgan('dev'));
  }

  // Uploaded images (company logos). `crossOriginResourcePolicy` is relaxed so
  // the web client on another origin can render them.
  app.use(
    env.uploadPublicPath,
    express.static(env.uploadDir, { fallthrough: true, maxAge: '1h' }),
  );

  app.use(API_BASE_PATH, apiRouter);

  /**
   * The React build, served from this same process so one Render Web Service
   * hosts both halves of the application. Mounted AFTER the API so it can never
   * shadow an endpoint, and BEFORE `notFoundHandler` so unknown API paths still
   * get the JSON 404.
   *
   * Skipped when the build is absent — in development the client is served by
   * Vite on its own port, and the API must keep behaving exactly as before.
   */
  if (existsSync(join(WEB_DIST, 'index.html'))) {
    // `index: false` leaves "/" to the fallback below, so every HTML response
    // comes from one place.
    app.use(express.static(WEB_DIST, { index: false }));

    // Client-side routes (`/`, `/manage/companies`, ...) are not files on disk;
    // the app boots from index.html and the router takes over. GET only, so a
    // stray POST to an unknown path still returns the JSON 404.
    app.get(NON_SPA_PATHS, (_req, res) => {
      res.sendFile(join(WEB_DIST, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

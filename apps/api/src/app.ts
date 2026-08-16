import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

/** API base path. Change here only. */
export const API_BASE_PATH = '/api/v1';

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

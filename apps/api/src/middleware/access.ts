import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/api-response.js';

/** Methods that only read. Everything else changes insurance data. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function matchesToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which itself leaks nothing here.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The single boundary between reading insurance data and changing it.
 *
 * Reads are open: a future public aggregator consumes exactly the same
 * resource endpoints the admin UI does, and must never need its own API.
 * Writes are staff-only, and this is the ONE place that decides so — adding
 * real employee authentication later means editing this function, not hunting
 * through twenty-five routes.
 *
 * Behaviour today:
 *  - `ADMIN_API_TOKEN` unset (the current internal-only deployment): writes are
 *    allowed, exactly as before.
 *  - `ADMIN_API_TOKEN` set: writes require `Authorization: Bearer <token>`.
 *    A public client, which never holds the token, is then physically unable to
 *    modify anything.
 */
export const requireWriteAccess: RequestHandler = (req, _res, next) => {
  if (READ_ONLY_METHODS.has(req.method)) return next();

  const expected = env.adminApiToken;
  if (!expected) return next();

  const header = req.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  if (provided !== '' && matchesToken(provided, expected)) return next();

  next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to change insurance data.'));
};

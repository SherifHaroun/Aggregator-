import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/api-response.js';
import { verifySessionToken } from '../modules/auth/auth.tokens.js';

/** Methods that only read. Everything else changes insurance data. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Who is making the request, once their token has been read. */
export type AuthContext =
  { kind: 'admin'; email: string } | { kind: 'customer'; customerId: string };

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `readSession` when a valid session token was presented. */
    auth?: AuthContext;
  }
}

function matchesToken(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which itself leaks nothing here.
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearer(req: Request): string {
  const header = req.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
}

/**
 * The legacy shared secret, still honoured so a script or a deployment that
 * relies on `ADMIN_API_TOKEN` keeps working. Employees sign in instead.
 */
function presentsLegacyToken(req: Request): boolean {
  const expected = env.adminApiToken;
  if (!expected) return false;
  const provided = bearer(req);
  return provided !== '' && matchesToken(provided, expected);
}

/**
 * Read the session token, if one was sent, and say who it belongs to.
 *
 * Runs on every request and never refuses one: a bad or expired token simply
 * leaves `req.auth` unset, and whichever gate the route sits behind decides
 * what an anonymous caller may do.
 */
export const readSession: RequestHandler = (req, _res, next) => {
  const token = bearer(req);
  if (token !== '') {
    const claims = verifySessionToken(token);
    if (claims?.kind === 'admin') req.auth = { kind: 'admin', email: claims.subject };
    if (claims?.kind === 'customer') req.auth = { kind: 'customer', customerId: claims.subject };
  }
  next();
};

export function isAdmin(req: Request): boolean {
  return req.auth?.kind === 'admin' || presentsLegacyToken(req);
}

/** Refuse anyone who is not a signed-in employee. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (isAdmin(req)) return next();
  next(
    req.auth
      ? new HttpError(403, 'FORBIDDEN', 'Only Hadbrok staff can do that.')
      : new HttpError(401, 'UNAUTHENTICATED', 'Sign in as Hadbrok staff to continue.'),
  );
};

/**
 * The single boundary between reading insurance data and changing it.
 *
 * Reads are open: the public site consumes exactly the same resource
 * endpoints the admin UI does, and never needs its own API. Writes are
 * staff-only, and this is the ONE place that decides so.
 *
 * A signed-in employee passes. So does a caller presenting the legacy
 * `ADMIN_API_TOKEN`, when one is configured. When neither an admin login nor
 * a token is configured, writes stay open as they were before sign-in
 * existed — the internal-only deployment — so nothing breaks on a machine
 * that has not set the new variables yet.
 */
export const requireWriteAccess: RequestHandler = (req, _res, next) => {
  if (READ_ONLY_METHODS.has(req.method)) return next();
  if (isAdmin(req)) return next();
  if (!env.adminApiToken && !env.adminLoginConfigured) return next();

  next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to change insurance data.'));
};

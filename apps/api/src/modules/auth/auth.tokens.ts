/**
 * SESSION TOKENS: who somebody is, signed so it cannot be forged.
 *
 * A token is a small JSON claim — the kind of session, the subject, when it
 * expires — encoded and signed with HMAC-SHA256 under the server's secret.
 * Nothing is stored server-side: the signature is the proof. Rotating the
 * secret signs everybody out, which is the one thing it is for.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

export interface SessionClaims {
  kind: 'admin' | 'customer';
  /** The admin's email, or the customer's id. */
  subject: string;
  /** Unix milliseconds. */
  expiresAt: number;
}

/** Thirty days: a customer who comes back next month is still signed in. */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url');
}

export function issueSessionToken(claims: Omit<SessionClaims, 'expiresAt'>): string {
  const payload = encode(
    JSON.stringify({
      ...claims,
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
    } satisfies SessionClaims),
  );
  return `${payload}.${sign(payload)}`;
}

/** The claims a token carries, or `null` for anything tampered with or expired. */
export function verifySessionToken(token: string): SessionClaims | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const claims = JSON.parse(decode(payload)) as Partial<SessionClaims>;
    if (
      (claims.kind !== 'admin' && claims.kind !== 'customer') ||
      typeof claims.subject !== 'string' ||
      typeof claims.expiresAt !== 'number' ||
      claims.expiresAt <= Date.now()
    ) {
      return null;
    }
    return { kind: claims.kind, subject: claims.subject, expiresAt: claims.expiresAt };
  } catch {
    return null;
  }
}

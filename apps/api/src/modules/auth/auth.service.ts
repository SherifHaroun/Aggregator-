/**
 * SIGNING IN — the broker's own account, and nobody else.
 *
 * The employee gives an email and a password. If the email is the account
 * configured in the environment — never the database, never the code — the
 * password is checked against it, in constant time, and the session is the
 * employee's. There are no other accounts: the customer site asks a visitor
 * for their details and writes them down as a lead, and never for a password.
 */

import { timingSafeEqual } from 'node:crypto';
import type { LoginResultDto, SessionDto } from '@aggregator/shared';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/api-response.js';
import type { LoginPayload } from './auth.schemas.js';
import { issueSessionToken } from './auth.tokens.js';

function sameSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const WRONG = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'That email and password do not match.');

function adminAccount(): { email: string; password: string } | null {
  const email = env.adminEmail?.trim().toLowerCase();
  const password = env.adminPassword;
  return email && password ? { email, password } : null;
}

export async function signIn(input: LoginPayload): Promise<LoginResultDto> {
  const email = input.email.trim().toLowerCase();
  const admin = adminAccount();
  if (!admin || email !== admin.email || !sameSecret(input.password, admin.password)) {
    throw WRONG();
  }
  const session: SessionDto = { kind: 'admin', email };
  return { token: issueSessionToken({ kind: 'admin', subject: email }), session };
}

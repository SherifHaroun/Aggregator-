/**
 * SIGNING IN.
 *
 * ONE DOOR. Everybody gives an email and a password. If the email is the
 * broker's configured account — from the environment, never the database,
 * never the code — the password is checked against that and the session is
 * the employee's. Otherwise the email is looked up among the customers and
 * the password against the hash on their record.
 *
 * A customer without an account SIGNS UP: name, email, password and the
 * company they buy for. A caller the broker already wrote down under that
 * email is not written twice — their record simply gains the password —
 * and either way the record is the same one the employees work with, and
 * the cart is the same cart.
 *
 * Passwords are never stored: scrypt with a fresh salt each time, compared
 * in constant time.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { LoginResultDto, SessionDto } from '@aggregator/shared';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/api-response.js';
import { getPrisma } from '../../lib/prisma.js';
import { getCustomer } from '../customers/customers.service.js';
import type { LoginPayload, SignUpPayload } from './auth.schemas.js';
import { issueSessionToken } from './auth.tokens.js';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

function sameSecret(provided: string | Buffer, expected: string | Buffer): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** `scrypt$<salt>$<key>`, both hex, so the format can change later without a migration. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const candidate = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return sameSecret(candidate, Buffer.from(key, 'hex'));
}

const WRONG = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'That email and password do not match.');

function adminAccount(): { email: string; password: string } | null {
  const email = env.adminEmail?.trim().toLowerCase();
  const password = env.adminPassword;
  return email && password ? { email, password } : null;
}

async function customerSession(customerId: string): Promise<LoginResultDto> {
  const session: SessionDto = { kind: 'customer', customer: await getCustomer(customerId) };
  return { token: issueSessionToken({ kind: 'customer', subject: customerId }), session };
}

export async function signIn(input: LoginPayload): Promise<LoginResultDto> {
  const email = input.email.trim().toLowerCase();

  const admin = adminAccount();
  if (admin && email === admin.email) {
    if (!sameSecret(input.password, admin.password)) throw WRONG();
    const session: SessionDto = { kind: 'admin', email };
    return { token: issueSessionToken({ kind: 'admin', subject: email }), session };
  }

  const customer = await getPrisma().customer.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, passwordHash: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, passwordHash: true },
  });
  if (!customer?.passwordHash || !(await verifyPassword(input.password, customer.passwordHash))) {
    throw WRONG();
  }
  return customerSession(customer.id);
}

export async function signUp(input: SignUpPayload): Promise<LoginResultDto> {
  const prisma = getPrisma();
  const email = input.email.trim().toLowerCase();

  const admin = adminAccount();
  if (admin && email === admin.email) {
    throw new HttpError(
      409,
      'ACCOUNT_EXISTS',
      'That email already has an account. Log in instead.',
    );
  }

  const existing = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, passwordHash: true, companyName: true },
  });
  if (existing?.passwordHash) {
    throw new HttpError(
      409,
      'ACCOUNT_EXISTS',
      'That email already has an account. Log in instead.',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const companyName = input.companyName ?? null;

  if (existing) {
    /* A caller the broker wrote down: the record is theirs, it gains the password. */
    await prisma.customer.update({
      where: { id: existing.id },
      data: { passwordHash, companyName: companyName ?? existing.companyName },
    });
    return customerSession(existing.id);
  }

  const created = await prisma.customer.create({
    data: { name: input.name.trim(), email, companyName, passwordHash, source: 'WEBSITE' },
    select: { id: true },
  });
  return customerSession(created.id);
}

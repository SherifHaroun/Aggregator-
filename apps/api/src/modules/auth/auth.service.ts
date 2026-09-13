/**
 * SIGNING IN.
 *
 * An employee is the broker's one configured account: email and password
 * from the environment, never from the database and never from the code.
 *
 * A customer is whoever says who they are: matched to the customer already
 * on record by email or phone, or written down as a new one — marked as
 * having come from the website, so the admin's Customers page can tell a
 * caller from a visitor. Either way the record is the same one the
 * employees work with, and the cart is the same cart.
 */

import { timingSafeEqual } from 'node:crypto';
import type { LoginResultDto, SessionDto } from '@aggregator/shared';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/api-response.js';
import { getPrisma } from '../../lib/prisma.js';
import { getCustomer } from '../customers/customers.service.js';
import { issueSessionToken } from './auth.tokens.js';

function sameSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signInAdmin(input: { email: string; password: string }): LoginResultDto {
  const email = env.adminEmail?.trim().toLowerCase() ?? null;
  const password = env.adminPassword ?? null;
  if (!email || !password) {
    throw new HttpError(
      503,
      'ADMIN_LOGIN_NOT_CONFIGURED',
      'Staff sign-in is not set up on this server (ADMIN_EMAIL and ADMIN_PASSWORD).',
    );
  }
  if (input.email.trim().toLowerCase() !== email || !sameSecret(input.password, password)) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'That email and password do not match.');
  }
  const session: SessionDto = { kind: 'admin', email };
  return { token: issueSessionToken({ kind: 'admin', subject: email }), session };
}

/** Digits only, so "0100 123 4567" and "01001234567" are the same caller. */
function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function signInCustomer(input: {
  name: string;
  email: string;
  phone: string;
}): Promise<LoginResultDto> {
  const prisma = getPrisma();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();

  let customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });

  if (!customer) {
    /**
     * The same person under a different address is still found by the
     * number they gave — compared digit for digit, since spacing varies.
     */
    const digits = phoneDigits(phone);
    const byPhone = await prisma.customer.findMany({
      where: { phone: { not: null } },
      orderBy: { createdAt: 'asc' },
    });
    customer = byPhone.find((row) => row.phone && phoneDigits(row.phone) === digits) ?? null;
  }

  if (!customer) {
    customer = await prisma.customer.create({
      data: { name: input.name.trim(), email, phone, source: 'WEBSITE' },
    });
  } else if (!customer.email || !customer.phone) {
    // A caller the broker wrote down with only a name now gives the rest.
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(customer.email ? {} : { email }),
        ...(customer.phone ? {} : { phone }),
      },
    });
  }

  const dto = await getCustomer(customer.id);
  const session: SessionDto = { kind: 'customer', customer: dto };
  return { token: issueSessionToken({ kind: 'customer', subject: customer.id }), session };
}

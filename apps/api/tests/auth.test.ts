/**
 * SIGNING IN, and what a session lets you reach.
 *
 * ONE DOOR: everybody gives an email and a password. The configured account
 * comes out as the employee and may see every customer; anybody else is a
 * customer who sees only themselves, as `me`. Nobody signed in sees anybody.
 *
 * Signing up and signing in as a customer write to the database, so that
 * part runs only with `TEST_DATABASE_URL`; tokens and gates run anywhere.
 */

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'SESSION_SECRET', 'ADMIN_API_TOKEN'] as const;
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.resetModules();
});

async function startApp(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>): Promise<string> {
  for (const key of ENV_KEYS) {
    /* Blank rather than absent: dotenv fills absent keys from .env. */
    process.env[key] = vars[key] ?? '';
  }
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

const json = (body: unknown, token?: string): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

const STAFF = {
  ADMIN_EMAIL: 'info@hadbrok.com',
  ADMIN_PASSWORD: 'pw-for-tests',
  SESSION_SECRET: 's',
};

describe('session tokens', () => {
  it('carry who somebody is, and refuse tampering and expiry', async () => {
    process.env['SESSION_SECRET'] = 'test-secret';
    vi.resetModules();
    const { issueSessionToken, verifySessionToken } =
      await import('../src/modules/auth/auth.tokens.js');
    const token = issueSessionToken({ kind: 'customer', subject: 'customer_1' });
    expect(verifySessionToken(token)).toMatchObject({ kind: 'customer', subject: 'customer_1' });

    /** One character changed anywhere is nobody. */
    const [payload, signature] = token.split('.') as [string, string];
    expect(verifySessionToken(`${payload}.${signature.slice(0, -1)}x`)).toBeNull();
    const forged = Buffer.from(
      JSON.stringify({ kind: 'admin', subject: 'x', expiresAt: 9e15 }),
    ).toString('base64url');
    expect(verifySessionToken(`${forged}.${signature}`)).toBeNull();
    expect(verifySessionToken('nonsense')).toBeNull();

    /** And yesterday's token is nobody either. */
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(token)).toBeNull();
    vi.useRealTimers();
  });
});

describe('staff sign-in', () => {
  it('admits the configured account and refuses everything else', async () => {
    const base = await startApp(STAFF);

    const wrong = await fetch(
      `${base}/api/v1/auth/login`,
      json({ email: 'info@hadbrok.com', password: 'nope' }),
    );
    expect(wrong.status).toBe(401);

    const other = await fetch(
      `${base}/api/v1/auth/login`,
      json({ email: 'someone@else.com', password: 'pw-for-tests' }),
    );
    expect(other.status).toBe(401);

    const right = await fetch(
      `${base}/api/v1/auth/login`,
      json({ email: 'INFO@hadbrok.com', password: 'pw-for-tests' }),
    );
    expect(right.status).toBe(200);
    const { data } = (await right.json()) as { data: { token: string; session: unknown } };
    expect(data.session).toEqual({ kind: 'admin', email: 'info@hadbrok.com' });

    /** The token says who they are, and opens the staff-only reads. */
    const who = await fetch(`${base}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    expect(who.status).toBe(200);
    const customers = await fetch(`${base}/api/v1/customers`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    expect(customers.status).not.toBe(401);
    expect(customers.status).not.toBe(403);
  });

  it('treats the broker’s email as nobody special when no staff account is configured', async () => {
    const base = await startApp({});
    const response = await fetch(
      `${base}/api/v1/auth/login`,
      json({ email: 'info@hadbrok.com', password: 'anything' }),
    );
    expect(response.status).toBe(401);
  });
});

describe('who may see customers', () => {
  it('shows nobody to an anonymous caller, and asks them to sign in', async () => {
    const base = await startApp(STAFF);
    for (const path of ['/api/v1/customers', '/api/v1/customers/cart', '/api/v1/customers/abc']) {
      const response = await fetch(`${base}${path}`);
      expect(response.status, path).toBe(401);
    }
    expect((await fetch(`${base}/api/v1/customers/me`)).status).toBe(401);
    expect((await fetch(`${base}/api/v1/auth/session`)).status).toBe(401);
  });

  it('keeps a customer to their own record', async () => {
    const base = await startApp(STAFF);
    vi.resetModules();
    const { issueSessionToken } = await import('../src/modules/auth/auth.tokens.js');
    const token = issueSessionToken({ kind: 'customer', subject: 'customer_1' });
    const headers = { Authorization: `Bearer ${token}` };

    expect((await fetch(`${base}/api/v1/customers`, { headers })).status).toBe(403);
    expect((await fetch(`${base}/api/v1/customers/cart`, { headers })).status).toBe(403);
    expect((await fetch(`${base}/api/v1/customers/somebody-else`, { headers })).status).toBe(403);
    expect((await fetch(`${base}/api/v1/customers/me`, { method: 'DELETE', headers })).status).toBe(
      403,
    );
  });

  it('still lets a caller with the legacy token through', async () => {
    const base = await startApp({ ...STAFF, ADMIN_API_TOKEN: 'legacy' });
    const response = await fetch(`${base}/api/v1/customers`, {
      headers: { Authorization: 'Bearer legacy' },
    });
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it('closes insurance-data writes to anonymous callers once staff sign-in exists', async () => {
    const base = await startApp(STAFF);
    const response = await fetch(`${base}/api/v1/companies`, json({}));
    expect(response.status).toBe(403);
  });
});

// --- with a database: a customer signs in and is on record ---------------------

const url = process.env['TEST_DATABASE_URL'];
const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const PREFIX = `test_auth_${Date.now()}`;

afterAll(async () => {
  if (!prisma) return;
  await prisma.customer.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe.skipIf(!url)('customer sign-up and sign-in', () => {
  it('writes a new customer down from the website, and lets them back in with their password', async () => {
    const base = await startApp(STAFF);
    const email = `${PREFIX.toLowerCase()}@example.com`;

    const created = await fetch(
      `${base}/api/v1/auth/signup`,
      json({
        name: `${PREFIX} Mona`,
        email: email.toUpperCase(),
        password: 'a-good-password',
        companyName: 'Mona Trading',
      }),
    );
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as {
      data: {
        token: string;
        session: {
          kind: string;
          customer: { id: string; source: string; companyName: string | null; email: string };
        };
      };
    };
    expect(data.session.kind).toBe('customer');
    expect(data.session.customer).toMatchObject({
      source: 'WEBSITE',
      companyName: 'Mona Trading',
      email,
    });

    /** The same email cannot sign up twice. */
    const twice = await fetch(
      `${base}/api/v1/auth/signup`,
      json({ name: 'Mona', email, password: 'another-password' }),
    );
    expect(twice.status).toBe(409);

    /** Back in with the right password, however the email is spelt; not with the wrong one. */
    const wrong = await fetch(`${base}/api/v1/auth/login`, json({ email, password: 'nope' }));
    expect(wrong.status).toBe(401);
    const again = await fetch(
      `${base}/api/v1/auth/login`,
      json({ email: email.toUpperCase(), password: 'a-good-password' }),
    );
    expect(again.status).toBe(200);
    const second = (await again.json()) as { data: { session: { customer: { id: string } } } };
    expect(second.data.session.customer.id).toBe(data.session.customer.id);

    /** And the token opens exactly their own record. */
    const me = await fetch(`${base}/api/v1/customers/me`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { data: { id: string } }).data.id).toBe(data.session.customer.id);

    /** A customer the broker wrote down cannot log in until they sign up... */
    const omarEmail = `${PREFIX.toLowerCase()}.omar@example.com`;
    const written = await prisma!.customer.create({
      data: { name: `${PREFIX} Omar`, phone: '0111 222 3333', email: omarEmail },
    });
    const early = await fetch(
      `${base}/api/v1/auth/login`,
      json({ email: omarEmail, password: 'omar-password' }),
    );
    expect(early.status).toBe(401);

    /** ...and signing up gives THAT record the password rather than writing a second Omar. */
    const omar = await fetch(
      `${base}/api/v1/auth/signup`,
      json({ name: 'Omar', email: omarEmail, password: 'omar-password' }),
    );
    expect(omar.status).toBe(201);
    const matched = (await omar.json()) as {
      data: { session: { customer: { id: string; source: string; phone: string | null } } };
    };
    expect(matched.data.session.customer.id).toBe(written.id);
    expect(matched.data.session.customer.source).toBe('STAFF');
    expect(matched.data.session.customer.phone).toBe('0111 222 3333');

    /** Passwords are never stored as given. */
    const row = await prisma!.customer.findUnique({ where: { id: written.id } });
    expect(row?.passwordHash).toMatch(/^scrypt\$/);
    expect(row?.passwordHash).not.toContain('omar-password');
  });
});

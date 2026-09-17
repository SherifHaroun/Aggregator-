/**
 * SIGNING IN, and what a session lets you reach.
 *
 * ONE ACCOUNT: the broker's, configured on the server. Its session may see
 * every customer and the bell. Nobody else can sign in — the customer site
 * has no accounts — and nobody signed in sees anybody. The customer site's
 * own writes go through `/leads`, which needs no session and reaches only
 * the lead it names.
 *
 * Tokens and gates run anywhere; nothing here touches the database.
 */

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  it('carry who somebody is, and refuse tampering, expiry and any kind but staff', async () => {
    process.env['SESSION_SECRET'] = 'test-secret';
    vi.resetModules();
    const { issueSessionToken, verifySessionToken } =
      await import('../src/modules/auth/auth.tokens.js');
    const token = issueSessionToken({ kind: 'admin', subject: 'info@hadbrok.com' });
    expect(verifySessionToken(token)).toMatchObject({ kind: 'admin', subject: 'info@hadbrok.com' });

    /** One character changed anywhere is nobody. */
    const [payload, signature] = token.split('.') as [string, string];
    expect(verifySessionToken(`${payload}.${signature.slice(0, -1)}x`)).toBeNull();
    const forged = Buffer.from(
      JSON.stringify({ kind: 'admin', subject: 'x', expiresAt: 9e15 }),
    ).toString('base64url');
    expect(verifySessionToken(`${forged}.${signature}`)).toBeNull();
    expect(verifySessionToken('nonsense')).toBeNull();

    /** A token from the days of customer accounts is nobody now. */
    const { createHmac } = await import('node:crypto');
    const customerPayload = Buffer.from(
      JSON.stringify({ kind: 'customer', subject: 'customer_1', expiresAt: 9e15 }),
    ).toString('base64url');
    const customerSignature = createHmac('sha256', 'test-secret')
      .update(customerPayload)
      .digest('base64url');
    expect(verifySessionToken(`${customerPayload}.${customerSignature}`)).toBeNull();

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

    /** There is nothing to sign up for: refused by the gate, or unknown — never made. */
    const signup = await fetch(
      `${base}/api/v1/auth/signup`,
      json({ name: 'Mona', email: 'mona@example.com', password: 'a-good-password' }),
    );
    expect([403, 404]).toContain(signup.status);

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
    for (const path of ['/api/v1/customers', '/api/v1/notifications']) {
      const response = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      expect(response.status, path).not.toBe(401);
      expect(response.status, path).not.toBe(403);
    }
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

describe('who may see what', () => {
  it('shows the broker’s records to nobody who is not signed in', async () => {
    const base = await startApp(STAFF);
    for (const path of [
      '/api/v1/customers',
      '/api/v1/customers/cart',
      '/api/v1/customers/abc',
      '/api/v1/customers/me',
      '/api/v1/notifications',
    ]) {
      const response = await fetch(`${base}${path}`);
      expect(response.status, path).toBe(401);
    }
    expect((await fetch(`${base}/api/v1/auth/session`)).status).toBe(401);
    expect((await fetch(`${base}/api/v1/notifications/seen`, json({}))).status).toBe(401);
  });

  it('lets a visitor write a lead without any session, and refuses one that is not a lead', async () => {
    const base = await startApp(STAFF);
    /** The route is open: the answer is validation, never a demand to sign in. */
    const empty = await fetch(`${base}/api/v1/leads`, json({}));
    expect(empty.status).toBe(400);
    const missing = await fetch(`${base}/api/v1/leads/does-not-exist`);
    expect(missing.status).not.toBe(401);
    expect(missing.status).not.toBe(403);
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

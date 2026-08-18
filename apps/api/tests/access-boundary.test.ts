/**
 * The boundary between reading insurance data and changing it.
 *
 * A future public aggregator consumes the same resource endpoints the admin UI
 * does, so reads must stay open — but a public client must never be able to
 * modify insurance data. `requireWriteAccess` is the single gate that decides,
 * and these tests pin that contract down.
 */

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalToken = process.env['ADMIN_API_TOKEN'];
let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  if (originalToken === undefined) delete process.env['ADMIN_API_TOKEN'];
  else process.env['ADMIN_API_TOKEN'] = originalToken;
  vi.resetModules();
});

async function startApp(token?: string): Promise<string> {
  if (token === undefined) delete process.env['ADMIN_API_TOKEN'];
  else process.env['ADMIN_API_TOKEN'] = token;
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

/** Endpoints a public aggregator would read. None may ever require a token. */
const PUBLIC_READS = [
  '/api/v1/health',
  '/api/v1/configuration/comparison',
  '/api/v1/companies',
  '/api/v1/insurance-types',
  '/api/v1/insurance-options',
  '/api/v1/plans',
  '/api/v1/plan-configurations',
];

/** A representative write on each data resource. */
const WRITES: [string, string][] = [
  ['POST', '/api/v1/companies'],
  ['PATCH', '/api/v1/companies/abc'],
  ['DELETE', '/api/v1/companies/abc'],
  ['POST', '/api/v1/insurance-types'],
  ['POST', '/api/v1/insurance-options'],
  ['DELETE', '/api/v1/option-fields/abc'],
  ['POST', '/api/v1/plans'],
  ['POST', '/api/v1/plan-configurations'],
  ['PUT', '/api/v1/plan-options/abc/values'],
  ['POST', '/api/v1/uploads/image'],
];

describe('with no token configured (today’s internal-only deployment)', () => {
  it('leaves writes working exactly as before', async () => {
    const base = await startApp(undefined);
    for (const [method, path] of WRITES) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : '{}',
      });
      // Anything but 403 means the gate let it through to the real handler.
      expect(response.status, `${method} ${path}`).not.toBe(403);
    }
  });
});

describe('with a token configured (a public client can reach the API)', () => {
  it('refuses every write that does not present it', async () => {
    const base = await startApp('staff-secret');
    for (const [method, path] of WRITES) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : '{}',
      });
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(await response.json()).toMatchObject({
        ok: false,
        error: { code: 'FORBIDDEN' },
      });
    }
  });

  it('still allows every public read without a token', async () => {
    const base = await startApp('staff-secret');
    for (const path of PUBLIC_READS) {
      const response = await fetch(`${base}${path}`);
      expect(response.status, path).not.toBe(403);
    }
  });

  it('admits a write that presents the token', async () => {
    const base = await startApp('staff-secret');
    const response = await fetch(`${base}/api/v1/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer staff-secret' },
      body: JSON.stringify({}),
    });
    // Reaches validation (400) rather than being rejected by the gate (403).
    expect(response.status).toBe(400);
  });

  it('rejects a wrong token', async () => {
    const base = await startApp('staff-secret');
    const response = await fetch(`${base}/api/v1/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' },
      body: '{}',
    });
    expect(response.status).toBe(403);
  });
});

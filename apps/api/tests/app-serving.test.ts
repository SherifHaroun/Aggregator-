/**
 * Regression test for how the API serves the web client.
 *
 * `npm run dev` does not rebuild `apps/web/dist`, so serving that directory in
 * development hands out a frozen snapshot of the last `npm run build` — the
 * code being edited is silently ignored, and old bugs appear to persist. The
 * SPA must therefore be served in production only, while the API itself keeps
 * working identically in both modes.
 */

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalNodeEnv = process.env['NODE_ENV'];
let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  process.env['NODE_ENV'] = originalNodeEnv;
  vi.resetModules();
});

/** Boot the app fresh under a given NODE_ENV and return its base URL. */
async function startApp(nodeEnv: string): Promise<string> {
  process.env['NODE_ENV'] = nodeEnv;
  vi.resetModules();
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server!.once('listening', () => resolve()));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

describe('development', () => {
  it('does not serve the built client, so a stale bundle cannot mask live code', async () => {
    const base = await startApp('development');
    const response = await fetch(`${base}/companies`, { headers: { Accept: 'text/html' } });

    expect(response.status).toBe(404);
    const body = await response.text();
    // A signpost to the dev server, never the built application shell.
    expect(body).toContain('This port serves the API only');
    expect(body).not.toContain('<div id="root">');
  });

  it('still serves the API normally', async () => {
    const base = await startApp('development');
    const response = await fetch(`${base}/api/v1/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it('keeps the JSON 404 for unknown API paths', async () => {
    const base = await startApp('development');
    const response = await fetch(`${base}/api/v1/nope`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});

describe('production', () => {
  it('serves the built client shell for a deep client route', async () => {
    const base = await startApp('production');
    const response = await fetch(`${base}/companies`, { headers: { Accept: 'text/html' } });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('<div id="root">');
  });

  it('never lets the client fallback swallow an API route', async () => {
    const base = await startApp('production');
    const response = await fetch(`${base}/api/v1/nope`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});

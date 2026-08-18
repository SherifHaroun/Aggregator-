/**
 * Regression tests for the API client's response handling.
 *
 * Two real defects lived here:
 *  1. `204 No Content` (every DELETE and both reorder endpoints) was fed to
 *     `response.json()`, which throws — so deleting anything reported
 *     "The server returned an unreadable response."
 *  2. Any non-JSON body — notably the dev proxy's plain-text 500 when the API
 *     process is not running — was reported the same way, hiding the real
 *     cause from the employee and from the console.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiRequest } from '@/lib/api-client';
import { describeError } from '@/components/ui/DataState';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function respondWith(body: BodyInit | null, init: ResponseInit) {
  globalThis.fetch = (async () => new Response(body, init)) as typeof fetch;
}

describe('204 No Content', () => {
  it('resolves instead of failing to parse an empty body', async () => {
    respondWith(null, { status: 204 });
    await expect(api.delete('/companies/abc')).resolves.toBeUndefined();
  });
});

describe('non-JSON responses', () => {
  it('reports an unreachable server rather than an unreadable body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Exactly what the Vite proxy returned when the API was not running.
    respondWith('Error: connect ECONNREFUSED 127.0.0.1:4000', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });

    const error = await apiRequest('/companies').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('SERVER_UNREACHABLE');
    expect((error as ApiError).status).toBe(500);
    expect(describeError(error, 'insurance companies')).toMatch(/cannot reach the server/i);
    expect(describeError(error, 'insurance companies')).not.toMatch(/unreadable/i);
  });

  it('logs the real status and body so the cause is visible', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    respondWith('<html>Bad Gateway</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });

    await apiRequest('/companies').catch(() => undefined);

    expect(logged).toHaveBeenCalled();
    expect(String(logged.mock.calls[0]?.[0])).toContain('502');
    expect(String(logged.mock.calls[0]?.[1])).toContain('Bad Gateway');
  });

  it('surfaces the proxy’s API_UNREACHABLE envelope message', async () => {
    respondWith(
      JSON.stringify({
        ok: false,
        error: { code: 'API_UNREACHABLE', message: 'The API server is not running.' },
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );

    const error = await apiRequest('/companies').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('API_UNREACHABLE');
    expect(describeError(error, 'insurance companies')).toMatch(/cannot reach the server/i);
  });
});

describe('network failure', () => {
  it('turns a rejected fetch into a readable error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    const error = await apiRequest('/companies').catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect(describeError(error, 'insurance companies')).toMatch(/cannot reach the server/i);
  });
});

describe('successful responses still work', () => {
  it('unwraps the ApiResponse envelope', async () => {
    respondWith(JSON.stringify({ ok: true, data: { items: [], total: 0 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(apiRequest('/companies')).resolves.toEqual({ items: [], total: 0 });
  });

  it('passes field-level validation details through', async () => {
    respondWith(
      JSON.stringify({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request payload is invalid.',
          details: { name: ['String must contain at least 1 character(s)'] },
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );

    const error = (await api.post('/companies', {}).catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.name?.[0]).toContain('at least 1 character');
  });
});

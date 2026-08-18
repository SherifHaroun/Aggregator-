/**
 * Thin fetch wrapper around the API.
 * Every request goes through here, so auth headers, error handling and the
 * base URL are configured in one file.
 */

import type { ApiResponse } from '@aggregator/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Read a response body once and turn it into the shared `ApiResponse` envelope.
 *
 * Anything that is not the envelope — a proxy error page, an HTML 404, an empty
 * body — is reported with its REAL status and a message that says what actually
 * happened, rather than a blanket "unreadable response". The raw body is logged
 * so the cause is visible in the console instead of being swallowed.
 */
async function readEnvelope<T>(response: Response, path: string): Promise<ApiResponse<T>> {
  // 204 No Content is a legitimate empty success (DELETE, reorder).
  if (response.status === 204) return { ok: true, data: undefined as T };

  const text = await response.text();

  if (text.trim() === '') {
    throw new ApiError(
      response.ok ? 'EMPTY_RESPONSE' : 'SERVER_ERROR',
      `The server returned an empty response (HTTP ${response.status}).`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    // Not JSON. In development this is nearly always the Vite proxy reporting
    // that the API process is not reachable.
    console.error(
      `[api] ${path} returned non-JSON (HTTP ${response.status}, ${
        response.headers.get('content-type') ?? 'no content-type'
      }):`,
      text.slice(0, 500),
    );
    throw new ApiError(
      response.status >= 500 ? 'SERVER_UNREACHABLE' : 'INVALID_RESPONSE',
      response.status >= 500
        ? 'Could not reach the API server. Check that it is running.'
        : `The server responded with HTTP ${response.status} instead of data.`,
      response.status,
    );
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (cause) {
    // fetch only rejects when the request never completed: no network, DNS
    // failure, or nothing listening at all.
    console.error(`[api] ${path} request failed:`, cause);
    throw new ApiError('NETWORK_ERROR', 'Could not reach the API server.', 0);
  }

  const payload = await readEnvelope<T>(response, path);

  if (!payload.ok) {
    throw new ApiError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.details,
    );
  }
  return payload.data;
}

/** Build a query string, skipping empty values. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
}

/**
 * Upload an image through the API and return its stored URL.
 * Uses the same base URL and error handling as every other request.
 */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);

  let response: Response;
  try {
    // No Content-Type header: the browser sets the multipart boundary.
    response = await fetch(`${BASE_URL}/uploads/image`, { method: 'POST', body });
  } catch (cause) {
    console.error('[api] upload request failed:', cause);
    throw new ApiError('NETWORK_ERROR', 'Could not reach the API server.', 0);
  }

  const payload = await readEnvelope<{ url: string }>(response, '/uploads/image');
  if (!payload.ok) {
    throw new ApiError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.details,
    );
  }
  return payload.data.url;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  put: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

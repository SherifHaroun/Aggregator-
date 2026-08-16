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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!payload) {
    throw new ApiError('INVALID_RESPONSE', 'The server returned an unreadable response.', response.status);
  }
  if (!payload.ok) {
    throw new ApiError(payload.error.code, payload.error.message, response.status, payload.error.details);
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

  const response = await fetch(`${BASE_URL}/uploads/image`, { method: 'POST', body });
  const payload = (await response.json().catch(() => null)) as ApiResponse<{ url: string }> | null;

  if (!payload) {
    throw new ApiError('INVALID_RESPONSE', 'The upload failed. Please try again.', response.status);
  }
  if (!payload.ok) {
    throw new ApiError(payload.error.code, payload.error.message, response.status, payload.error.details);
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

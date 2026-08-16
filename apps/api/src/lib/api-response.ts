/** Helpers so every endpoint answers with the shared `ApiResponse<T>` envelope. */

import type { ApiErrorPayload, ApiResponse } from '@aggregator/shared';

export function success<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function failure(error: ApiErrorPayload): ApiResponse<never> {
  return { ok: false, error };
}

/** An error carrying the HTTP status the handler should answer with. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

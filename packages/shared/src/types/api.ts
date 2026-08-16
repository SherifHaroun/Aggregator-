/**
 * Transport envelope shared by the API and the web client.
 * Every endpoint answers with `ApiResponse<T>` so the client has one code path.
 */

export interface ApiErrorPayload {
  code: string;
  message: string;
  /** Field-level messages, keyed by field name. */
  details?: Record<string, string[]>;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiErrorPayload };

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

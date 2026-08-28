/**
 * Where the API lives, and how to turn the paths it returns into URLs the
 * browser can actually fetch.
 *
 * Uploaded files are stored as root-relative paths (`/uploads/abc.png`) so the
 * database never records a hostname. In development that is enough: the Vite
 * proxy forwards `/uploads` to the API. In production the client is served from
 * a different origin than the API, so the same path would resolve against the
 * web origin and 404. `resolveAssetUrl` puts the API origin back in front of it.
 */

/** Anything with a scheme — `https:`, `data:`, `blob:` — is already complete. */
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/i;

/** Base path (or absolute URL) every API request is made against. */
export function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
}

/**
 * Origin of the API, or `''` when it is reached on this same origin — which is
 * the case whenever the base URL is itself relative, as in development.
 */
function apiOrigin(): string {
  const base = apiBaseUrl();
  const isAbsolute = ABSOLUTE_URL.test(base) || base.startsWith('//');
  if (!isAbsolute) return '';
  try {
    return new URL(base, globalThis.location?.href).origin;
  } catch {
    // A malformed VITE_API_BASE_URL must not break rendering; fall back to
    // same-origin, which is what the path meant before this function existed.
    return '';
  }
}

/**
 * Resolve a stored file path against the API.
 *
 * Absolute URLs (`https://…`), protocol-relative URLs (`//…`) and inline data
 * URLs are returned untouched — only paths are rewritten. Returns `undefined`
 * for a missing or blank value so callers can render their own fallback.
 */
export function resolveAssetUrl(url: string | null | undefined): string | undefined {
  const path = url?.trim();
  if (!path) return undefined;
  if (ABSOLUTE_URL.test(path) || path.startsWith('//')) return path;

  const origin = apiOrigin();
  if (!origin) return path;
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

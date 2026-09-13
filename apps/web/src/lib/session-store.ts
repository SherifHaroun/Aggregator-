/**
 * WHERE THE SESSION TOKEN LIVES.
 *
 * One string in localStorage, so a customer who closes the tab is still
 * signed in tomorrow. Read through a tiny external store rather than
 * directly, so every screen re-renders the moment somebody signs in or out
 * — the header, the guards and the API client all watch the same value.
 *
 * Storage can be unavailable (a private window, a browser that blocks site
 * data), so the value is mirrored in memory and every access is guarded.
 */

const KEY = 'hadbrok.session';

let inMemory: string | null = readStored();
const listeners = new Set<() => void>();

function readStored(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function readSessionToken(): string | null {
  return inMemory;
}

export function writeSessionToken(token: string | null): void {
  inMemory = token;
  try {
    if (token === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, token);
  } catch {
    /* The in-memory copy still serves this tab. */
  }
  for (const listener of listeners) listener();
}

/** For `useSyncExternalStore`. */
export function subscribeToSessionToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

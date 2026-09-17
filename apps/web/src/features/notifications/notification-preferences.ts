/**
 * WHAT THE EMPLOYEE WANTS FROM THE BELL.
 *
 * One preference: whether the panel slides open on its own when the admin is
 * opened and there is something new. It is this browser's, kept in
 * localStorage, because it is about how THIS screen greets the employee —
 * not a fact about the leads, which live on the server for everybody.
 *
 * Read through a tiny external store so the toggle in the panel and the
 * shell that decides whether to open it see the same value at once.
 */

import { useSyncExternalStore } from 'react';

const KEY = 'hadbrok.notifications.autoOpen';

/** Once per tab: the panel greets the employee when they arrive, not on every page. */
const SHOWN_KEY = 'hadbrok.notifications.greeted';

const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let autoOpen = readStored();

export function readAutoOpen(): boolean {
  return autoOpen;
}

export function writeAutoOpen(value: boolean): void {
  autoOpen = value;
  try {
    if (value) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, 'off');
  } catch {
    /* The in-memory value still serves this tab. */
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the panel may open on its own. */
export function useAutoOpenPreference(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribe, readAutoOpen, () => true);
  return [value, writeAutoOpen];
}

/** Whether this tab has already been greeted; marks it so on first ask. */
export function claimGreeting(): boolean {
  try {
    if (window.sessionStorage.getItem(SHOWN_KEY) === 'yes') return false;
    window.sessionStorage.setItem(SHOWN_KEY, 'yes');
    return true;
  } catch {
    return true;
  }
}

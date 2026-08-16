import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when Vitest globals are on.
// Without this, one test's DOM leaks into the next and queries find duplicates.
afterEach(cleanup);

/**
 * jsdom does not implement <dialog>. The Dialog component relies on
 * showModal/close, so provide minimal versions that keep the `open` state
 * consistent.
 */
const dialog = globalThis.HTMLDialogElement?.prototype;
if (dialog) {
  dialog.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  dialog.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

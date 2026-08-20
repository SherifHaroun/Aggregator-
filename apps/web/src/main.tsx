import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found.');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);

/**
 * Retire the opening screen declared in `index.html`.
 *
 * Held for a moment even when the application is ready sooner, because a
 * splash that appears and vanishes within a frame reads as a glitch rather
 * than as branding. It then fades out and is removed from the document, so it
 * cannot sit invisibly over the page.
 */
const SPLASH_MINIMUM_MS = 900;
const SPLASH_FADE_MS = 520;

const splash = document.getElementById('splash');
if (splash) {
  // Hidden by the head script because this session was already welcomed: take
  // it out at once rather than animating something nobody can see.
  if (document.documentElement.hasAttribute('data-splash-seen')) {
    splash.remove();
  } else {
    const remaining = Math.max(0, SPLASH_MINIMUM_MS - performance.now());

    window.setTimeout(() => {
      splash.dataset.leaving = 'true';
      window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
    }, remaining);
  }
}

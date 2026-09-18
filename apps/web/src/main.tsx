import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { router } from './app/router';
import { SITE_MODE, SITE_MODE_SOURCE } from './config/site';
import './styles/index.css';

/**
 * Which site this deployment is, said once where it can be checked: the
 * browser console, and `data-site-mode` on the root element. A deployment
 * that should be the admin and says "all (default)" was built without
 * `VITE_SITE_MODE` — add it on the host and redeploy.
 */
document.documentElement.dataset.siteMode = SITE_MODE;
console.info(`[hadbrok] site mode: ${SITE_MODE} (from ${SITE_MODE_SOURCE})`);

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

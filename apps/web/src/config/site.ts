/**
 * WHICH SITE THIS BUILD IS.
 *
 * One codebase, two sites: the customer site at `/` and the employee area
 * at `/admin`. They can be served together from one deployment, or APART —
 * the customer site on the public domain, the admin on a different URL of
 * its own — from the same build with one environment variable:
 *
 *   VITE_SITE_MODE=all       both, as in development (the default)
 *   VITE_SITE_MODE=customer  the customer site only; `/admin` does not exist
 *   VITE_SITE_MODE=admin     the employee area only; `/` goes to `/admin`
 *
 * Whatever the mode, both talk to ONE API and ONE database, so what happens
 * on one is on the other the moment it happens. When they are deployed
 * apart, `VITE_CUSTOMER_SITE_URL` tells the admin where the customer site
 * lives, so its "Customer site" link leads there rather than to a page
 * this deployment does not serve.
 */

export type SiteMode = 'all' | 'customer' | 'admin';

function readMode(): SiteMode {
  const raw = (import.meta.env.VITE_SITE_MODE ?? 'all').trim().toLowerCase();
  return raw === 'customer' || raw === 'admin' ? raw : 'all';
}

export const SITE_MODE: SiteMode = readMode();

export const SERVES_CUSTOMER_SITE = SITE_MODE !== 'admin';
export const SERVES_ADMIN_SITE = SITE_MODE !== 'customer';

/**
 * Where the customer site is, from the admin's point of view: an absolute
 * URL when the two are deployed apart, otherwise this site's own root.
 */
export const CUSTOMER_SITE_URL: string =
  (import.meta.env.VITE_CUSTOMER_SITE_URL ?? '').trim() || '/';

/** Whether that link leaves this deployment — drawn as an external link when it does. */
export const CUSTOMER_SITE_IS_EXTERNAL = /^https?:\/\//i.test(CUSTOMER_SITE_URL);

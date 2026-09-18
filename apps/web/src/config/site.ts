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
 *
 * THE VARIABLE IS READ AT BUILD TIME — Vite bakes it into the bundle — so a
 * deployment built before the variable was added keeps serving both until
 * it is REDEPLOYED. Because that is easy to miss, there is a second way in
 * that needs no variable at all: a deployment whose ADDRESS says it is the
 * admin (`admin.hadbrok.com`, `hadbrok-admin.vercel.app`) is the admin. The
 * variable, when set, always wins.
 */

export type SiteMode = 'all' | 'customer' | 'admin';

/** "admin" as a whole word in the host name: `admin.x.com`, `x-admin.vercel.app`. */
const ADMIN_HOST = /(^|[.-])admin([.-]|$)/i;

/** The mode the build was given, or `null` when none was. Quotes and case are forgiven. */
function modeFromBuild(): SiteMode | null {
  const raw = String(import.meta.env.VITE_SITE_MODE ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim()
    .toLowerCase();
  return raw === 'customer' || raw === 'admin' || raw === 'all' ? raw : null;
}

/** The mode the address implies, for a deployment that was given none. */
function modeFromHost(): SiteMode | null {
  const host = globalThis.location?.hostname ?? '';
  return ADMIN_HOST.test(host) ? 'admin' : null;
}

const fromBuild = modeFromBuild();

export const SITE_MODE: SiteMode = fromBuild ?? modeFromHost() ?? 'all';

/** Where the mode came from — said once in the console so a deployment can be checked. */
export const SITE_MODE_SOURCE: 'VITE_SITE_MODE' | 'host name' | 'default' =
  fromBuild !== null ? 'VITE_SITE_MODE' : SITE_MODE === 'admin' ? 'host name' : 'default';

export const SERVES_CUSTOMER_SITE = SITE_MODE !== 'admin';
export const SERVES_ADMIN_SITE = SITE_MODE !== 'customer';

/**
 * Where the customer site is, from the admin's point of view: an absolute
 * URL when the two are deployed apart, otherwise this site's own root.
 */
export const CUSTOMER_SITE_URL: string =
  String(import.meta.env.VITE_CUSTOMER_SITE_URL ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '') || '/';

/** Whether that link leaves this deployment — drawn as an external link when it does. */
export const CUSTOMER_SITE_IS_EXTERNAL = /^https?:\/\//i.test(CUSTOMER_SITE_URL);

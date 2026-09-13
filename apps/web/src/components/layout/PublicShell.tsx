import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { HadbrokLogo } from '@/components/ui/HadbrokLogo';
import { IconCart, IconClose, IconMenu } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { useCustomerSession, useSession, useSignOut } from '@/features/auth/auth.api';
import { loginUrl } from '@/features/auth/guards';
import { cn } from '@/lib/cn';

/**
 * THE CUSTOMER SITE'S FRAME.
 *
 * A slim navy bar with the broker's mark, three anchors into the home page,
 * and on the right the two things a visitor needs: their cart, and a way to
 * sign in — or their own name and a way out, once they have. Underneath, the
 * page; at the foot, how to reach the broker.
 */
export function PublicShell() {
  const { customer } = useCustomerSession();
  const session = useSession();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  function leave() {
    signOut();
    navigate(ROUTES.home);
  }

  const links = [
    { label: 'Compare plans', to: `${ROUTES.home}#compare` },
    { label: 'Services', to: `${ROUTES.home}#services` },
    { label: 'Contact', to: `${ROUTES.home}#contact` },
  ];

  return (
    <div className="bg-canvas flex min-h-dvh flex-col">
      <header className="bg-brand-strong sticky top-0 z-30 text-white shadow-(--shadow-card)">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link to={ROUTES.home} aria-label="Hadbrok Insurance Brokers home" className="shrink-0">
            <HadbrokLogo variant="wide" className="h-10 w-auto rounded-md" title="Hadbrok" />
          </Link>

          <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className="rounded-(--radius-control) px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {customer ? (
              <>
                <Link
                  to={ROUTES.public.cart}
                  className="relative flex size-10 items-center justify-center rounded-(--radius-control) text-white/90 transition-colors hover:bg-white/10"
                  aria-label={`My cart, ${customer.cartCount} ${customer.cartCount === 1 ? 'plan' : 'plans'}`}
                >
                  <IconCart className="size-5" />
                  <span
                    aria-hidden
                    data-testid="my-cart-count"
                    className="bg-accent text-brand-strong absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.7rem] font-bold tabular-nums"
                  >
                    {customer.cartCount}
                  </span>
                </Link>
                <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                  {customer.name}
                </span>
                <button
                  type="button"
                  onClick={leave}
                  className="rounded-(--radius-control) border border-white/25 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Sign out
                </button>
              </>
            ) : session.data?.kind === 'admin' ? (
              <>
                <Link
                  to={ROUTES.dashboard}
                  className="rounded-(--radius-control) border border-white/25 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Admin area
                </Link>
                <button
                  type="button"
                  onClick={leave}
                  className="px-2 py-1.5 text-sm font-medium text-white/80 hover:text-white"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to={loginUrl(pathname)}
                className="bg-accent text-brand-strong rounded-(--radius-control) px-4 py-2 text-sm font-bold shadow-(--shadow-card) transition-transform hover:scale-[1.02]"
              >
                Log in / Sign up
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="flex size-10 items-center justify-center rounded-(--radius-control) text-white/90 hover:bg-white/10 md:hidden"
            >
              {menuOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav aria-label="Site" className="border-t border-white/10 px-4 py-2 md:hidden">
            {links.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className="block rounded-(--radius-control) px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                {link.label}
              </NavLink>
            ))}
            {customer ? (
              <NavLink
                to={ROUTES.public.cart}
                className="block rounded-(--radius-control) px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                My cart
              </NavLink>
            ) : null}
          </nav>
        ) : null}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}

const PHONE_MOBILE = '+20 12 2235 2235';
const PHONE_OFFICE = '+2 02 3304 4664';

/** How to reach the broker: the same details the company site carries. */
function SiteFooter() {
  return (
    <footer id="contact" className="bg-brand-strong mt-16 text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <HadbrokLogo variant="wide" className="h-12 w-auto rounded-md" title="Hadbrok" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">
            Egypt’s leading insurance broker since 1982, working with private individuals, families
            and businesses to buy the right cover at the right price.
          </p>
        </div>

        <FooterColumn title="Our company">
          <FooterLink href="https://www.hadbrok.com/main/phib">About us</FooterLink>
          <FooterLink href="https://www.hadbrok.com/main/know">Services</FooterLink>
          <FooterLink href="https://www.hadbrok.com/main/regional">
            Regional capabilities
          </FooterLink>
          <FooterLink href="https://www.hadbrok.com/main/affiliated_companies">
            Affiliated companies
          </FooterLink>
          <FooterLink href="https://www.hadbrok.com/main/contact_us">
            Contact us · Careers
          </FooterLink>
        </FooterColumn>

        <FooterColumn title="Insurance types">
          <li className="text-sm text-white/80">Medical · Individual</li>
          <li className="text-sm text-white/80">Medical · Family</li>
          <li className="text-sm text-white/80">Medical · SME</li>
          <li className="text-sm text-white/80">Motor</li>
        </FooterColumn>

        <FooterColumn title="Get in touch">
          <li>
            <a href={`tel:${PHONE_MOBILE.replace(/\s/g, '')}`} className={footerLinkClass}>
              {PHONE_MOBILE}
            </a>
          </li>
          <li>
            <a href={`tel:${PHONE_OFFICE.replace(/\s/g, '')}`} className={footerLinkClass}>
              {PHONE_OFFICE}
            </a>
          </li>
          <li className="text-sm text-white/80">9am to 5pm, Sunday to Thursday</li>
          <li className="flex gap-4 pt-1">
            <a href="https://www.facebook.com/hadbrok" className={footerLinkClass}>
              Facebook
            </a>
            <a
              href="https://www.linkedin.com/company/hadbrok-insurance-brokers-s.a.e"
              className={footerLinkClass}
            >
              LinkedIn
            </a>
          </li>
        </FooterColumn>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-7xl px-4 py-5 text-xs text-white/55 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Hadbrok Insurance Brokers S.A.E. Paul Haddad Group of
          Companies.
        </p>
      </div>
    </footer>
  );
}

const footerLinkClass = 'text-sm text-white/80 transition-colors hover:text-white hover:underline';

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-accent mb-4 text-xs font-bold tracking-widest uppercase">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className={cn(footerLinkClass)}>
        {children}
      </a>
    </li>
  );
}

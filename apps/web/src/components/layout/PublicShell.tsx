import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { HadbrokLogo } from '@/components/ui/HadbrokLogo';
import { IconClose, IconMenu } from '@/components/ui/icons';
import { ROUTES } from '@/config/routes';
import { LocationChip } from '@/features/public/LocationChip';
import { ADDRESS, HOURS, PHONE_MOBILE, PHONE_OFFICE, tel } from '@/pages/public/CompanyPages';

/**
 * THE CUSTOMER SITE'S FRAME.
 *
 * A slim navy bar with the broker's mark, the compare card and the broker's
 * own pages, and on the right one thing a visitor might want: a way to
 * call. No sign-in, no cart — nobody has an account here; a visitor
 * compares, leaves their details, and is called back. Underneath, the page;
 * at the foot, how to reach the broker. Every link stays on this site:
 * nothing sends a visitor off to the old company site.
 */
export function PublicShell() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);
  useScrollOnNavigate();

  const links = [
    { label: 'Compare plans', to: `${ROUTES.home}#compare` },
    { label: 'About us', to: ROUTES.public.about },
    { label: 'Services', to: ROUTES.public.services },
    { label: 'Contact', to: ROUTES.public.contact },
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
            <a
              href={tel(PHONE_MOBILE)}
              className="hidden text-sm font-semibold text-white/85 transition-colors hover:text-white sm:block"
            >
              {PHONE_MOBILE}
            </a>
            <Link
              to={`${ROUTES.home}#compare`}
              className="bg-accent text-brand-strong rounded-(--radius-control) px-4 py-2 text-sm font-bold shadow-(--shadow-card) transition-transform hover:scale-[1.02]"
            >
              Get a quote
            </Link>
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
            <a
              href={tel(PHONE_MOBILE)}
              className="block rounded-(--radius-control) px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
            >
              Call {PHONE_MOBILE}
            </a>
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

/**
 * WHERE THE PAGE SITS AFTER A LINK IS FOLLOWED.
 *
 * The router changes the address and nothing else: "Compare plans" pointed at
 * `/#compare` and left the visitor wherever they already were — at the foot
 * of the home page, usually, looking at the link they had just pressed. So a
 * link with a `#target` is taken to it, including one pressed twice and one
 * whose page is still being drawn; and a link to another page starts at its
 * top. Back and forward are left alone, so the browser can put a visitor
 * back where they were.
 */
function useScrollOnNavigate() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();

  // A new PAGE starts at its top. Only the path counts: a link that changes
  // nothing but the query leaves the visitor where they are reading.
  useEffect(() => {
    if (hash === '' && navigationType === 'PUSH') document.documentElement.scrollTo?.({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (hash === '') return;

    const id = decodeURIComponent(hash.slice(1));
    let frame = 0;
    let tries = 0;
    const seek = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else if (tries < 30) {
        tries += 1;
        frame = requestAnimationFrame(seek);
      }
    };
    seek();
    return () => cancelAnimationFrame(frame);
    // `key` changes on every navigation, so the same link pressed again scrolls again.
  }, [hash, key]);
}

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
          <FooterLink to={ROUTES.public.about}>About us</FooterLink>
          <FooterLink to={ROUTES.public.services}>Services</FooterLink>
          <FooterLink to={ROUTES.public.regional}>Regional capabilities</FooterLink>
          <FooterLink to={ROUTES.public.affiliated}>Affiliated companies</FooterLink>
          <FooterLink to={ROUTES.public.contact}>Contact us</FooterLink>
          <FooterLink to={`${ROUTES.public.contact}#careers`}>Careers</FooterLink>
        </FooterColumn>

        <FooterColumn title="Insurance types">
          <FooterLink to={`${ROUTES.home}#compare`}>Medical · SME</FooterLink>
          <li className="text-sm text-white/60">Medical · Individual · coming soon</li>
          <li className="text-sm text-white/60">Medical · Family · coming soon</li>
          <li className="text-sm text-white/60">Motor · coming soon</li>
        </FooterColumn>

        <FooterColumn title="Get in touch">
          <li>
            <a href={tel(PHONE_MOBILE)} className={footerLinkClass}>
              {PHONE_MOBILE}
            </a>
          </li>
          <li>
            <a href={tel(PHONE_OFFICE)} className={footerLinkClass}>
              {PHONE_OFFICE}
            </a>
          </li>
          <li className="text-sm text-white/80">{HOURS}</li>
          <li className="py-2">
            <LocationChip address={ADDRESS} />
          </li>
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

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className={footerLinkClass}>
        {children}
      </Link>
    </li>
  );
}

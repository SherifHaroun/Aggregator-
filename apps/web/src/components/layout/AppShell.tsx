import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { IconClose, IconMenu, IconShield } from '@/components/ui/icons';
import { APP_NAME, APP_TAGLINE } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { SidebarNav } from './SidebarNav';

/**
 * Application frame: a fixed white sidebar on desktop, a slide-over drawer on
 * mobile, and a content column that stays comfortably readable at any width.
 */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the drawer whenever navigation happens, so a tap never leaves it open.
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="bg-canvas min-h-dvh">
      {/* Mobile top bar */}
      <header className="border-border-subtle bg-surface/90 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="text-content-muted hover:bg-surface-muted hover:text-content -ml-1 rounded-(--radius-control) p-2"
        >
          <IconMenu />
        </button>
        <BrandMark compact />
      </header>

      {/* Desktop sidebar */}
      <aside className="border-border-subtle bg-sidebar fixed inset-y-0 left-0 z-20 hidden w-[16.5rem] border-r lg:block">
        <div className="border-border-subtle flex h-18 items-center border-b px-5">
          <BrandMark />
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setNavOpen(false)}
          />
          <aside className="bg-sidebar absolute inset-y-0 left-0 w-[17rem] max-w-[86%] shadow-(--shadow-raised)">
            <div className="border-border-subtle flex h-18 items-center justify-between border-b px-5">
              <BrandMark />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="text-content-muted hover:text-content rounded-(--radius-control) p-1.5"
              >
                <IconClose />
              </button>
            </div>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-[16.5rem]">
        <div className="mx-auto w-full max-w-[76rem] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to={ROUTES.dashboard} className="flex items-center gap-2.5">
      <span className="bg-brand-gradient text-content-inverted flex size-9 items-center justify-center rounded-xl shadow-(--shadow-brand)">
        <IconShield className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="text-content block text-[0.95rem] leading-tight font-bold">
          {APP_NAME}
        </span>
        {!compact ? (
          <span className="text-content-subtle block text-[0.7rem] leading-tight">
            {APP_TAGLINE}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

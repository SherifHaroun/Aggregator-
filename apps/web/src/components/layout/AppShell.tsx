import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { HadbrokLogo } from '@/components/ui/HadbrokLogo';
import { IconClose, IconMenu } from '@/components/ui/icons';
import { APP_NAME, APP_TAGLINE } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { HelpWalkthrough } from '@/features/help';
import { cn } from '@/lib/cn';
import { SidebarNav } from './SidebarNav';

/**
 * Application frame: a fixed white sidebar on desktop, a slide-over drawer on
 * mobile, and a content column that stays comfortably readable at any width.
 */
export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  /*
   * The walkthrough lives here rather than in `SidebarNav`, because that
   * component is mounted twice on a small screen — once in the hidden desktop
   * aside, once in the drawer. State inside it would put two modal dialogs in
   * the top layer, one of them invisible.
   */
  const [helpOpen, setHelpOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the drawer whenever navigation happens, so a tap never leaves it open.
  useEffect(() => setNavOpen(false), [pathname]);

  /* On mobile the tour is opened from the drawer; close it so finishing the
     tour returns to the page rather than to the navigation. */
  function openHelp() {
    setNavOpen(false);
    setHelpOpen(true);
  }

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
        <SidebarNav onOpenHelp={openHelp} />
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
            <SidebarNav onNavigate={() => setNavOpen(false)} onOpenHelp={openHelp} />
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-[16.5rem]">
        <div className="mx-auto w-full max-w-[76rem] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>

      <HelpWalkthrough open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

/**
 * The company's own mark, with what this tool is beside it.
 *
 * The logo already says "Hadbrok Insurance Brokers", so the text next to it
 * names the application rather than repeating the company.
 */
function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to={ROUTES.dashboard}
      className="flex min-w-0 flex-col justify-center gap-1"
      aria-label={`${APP_NAME} ${APP_TAGLINE}`}
    >
      {/*
        The full lock-up where it has room to be read, and the wordmark alone
        on the mobile bar — at that height "Insurance Brokers" would be seen
        rather than read.
      */}
      <HadbrokLogo
        variant={compact ? 'name' : 'wide'}
        className={cn('w-auto rounded-md', compact ? 'h-8' : 'h-12')}
        title={APP_NAME}
      />
      {!compact ? (
        <span className="text-content-subtle block truncate text-[0.7rem] leading-tight">
          {APP_TAGLINE}
        </span>
      ) : null}
    </Link>
  );
}

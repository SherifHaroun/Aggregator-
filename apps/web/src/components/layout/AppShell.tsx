import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { APP_NAME, APP_SUBTITLE } from '@/config/navigation';
import { SidebarNav } from './SidebarNav';

/**
 * Application frame: fixed sidebar on desktop, slide-over drawer on mobile.
 * Every page renders inside the <Outlet />.
 */
export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="bg-canvas min-h-dvh">
      {/* Mobile top bar */}
      <div className="border-border-subtle bg-surface sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="text-content-muted hover:text-content -ml-1 rounded-(--radius-control) p-2"
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>
        <span className="text-content text-sm font-semibold">{APP_NAME}</span>
      </div>

      {/* Desktop sidebar */}
      <aside className="border-border-subtle bg-surface fixed inset-y-0 left-0 hidden w-64 border-r lg:block">
        <BrandBlock />
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="bg-surface absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-(--shadow-raised)">
            <BrandBlock />
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function BrandBlock() {
  return (
    <div className="border-border-subtle flex h-16 items-center gap-3 border-b px-5">
      <span className="bg-brand text-content-inverted flex size-9 items-center justify-center rounded-(--radius-control) text-sm font-bold">
        IA
      </span>
      <span className="min-w-0">
        <span className="text-content block truncate text-sm font-semibold">{APP_NAME}</span>
        <span className="text-content-subtle block text-xs">{APP_SUBTITLE}</span>
      </span>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 5h14M3 10h14M3 15h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

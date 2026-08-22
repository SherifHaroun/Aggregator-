import { NavLink, useLocation } from 'react-router-dom';
import { IconChevronRight, IconHelp } from '@/components/ui/icons';
import { NAV_ITEMS } from '@/config/navigation';
import { cn } from '@/lib/cn';

/** Renders whatever `NAV_ITEMS` describes — no hardcoded links. */
export function SidebarNav({
  onNavigate,
  onOpenHelp,
}: {
  onNavigate?: () => void;
  /** Opens the walkthrough. Owned by `AppShell`, which renders exactly one. */
  onOpenHelp: () => void;
}) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-[calc(100%-4.5rem)] flex-col">
      <nav className="flex-1 space-y-1 px-3 py-5">
        {NAV_ITEMS.map((item) => {
          const active = item.matchPrefix
            ? pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
            : pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={!item.matchPrefix}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-soft text-brand-strong'
                  : 'text-content-muted hover:bg-surface-muted hover:text-content',
              )}
            >
              <item.icon className={cn('size-5 shrink-0', active && 'text-brand')} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/*
        Support card, mirroring the reference layout's sidebar footer.

        It opens the walkthrough rather than stating a fact, so the answer to
        "how does this work?" is the guided tour instead of a sentence. Kept a
        button, and kept outside the <nav>: this is not a destination, and the
        navigation is exactly what `NAV_ITEMS` says it is.
      */}
      <div className="p-3">
        <button
          type="button"
          onClick={onOpenHelp}
          className={cn(
            'bg-surface-muted hover:bg-brand-soft group block w-full rounded-(--radius-card) p-4 text-left',
            'border border-transparent transition-colors hover:border-(--color-brand-border)',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="bg-brand text-content-inverted flex size-7 shrink-0 items-center justify-center rounded-full">
              <IconHelp className="size-4" />
            </span>
            <p className="text-content text-sm font-semibold">Need help?</p>
            <IconChevronRight className="text-content-subtle group-hover:text-brand ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </div>
          <p className="text-content-muted mt-2 text-xs leading-relaxed">
            Take the walkthrough — from adding a company to comparing plans, one step at a time.
          </p>
        </button>
      </div>
    </div>
  );
}

import { NavLink, useLocation } from 'react-router-dom';
import { IconHelp } from '@/components/ui/icons';
import { NAV_ITEMS } from '@/config/navigation';
import { cn } from '@/lib/cn';

/** Renders whatever `NAV_ITEMS` describes — no hardcoded links. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
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

      {/* Support card, mirroring the reference layout's sidebar footer. */}
      <div className="p-3">
        <div className="bg-surface-muted rounded-(--radius-card) p-4">
          <div className="flex items-center gap-2">
            <span className="bg-brand text-content-inverted flex size-7 items-center justify-center rounded-full">
              <IconHelp className="size-4" />
            </span>
            <p className="text-content text-sm font-semibold">Need help?</p>
          </div>
          <p className="text-content-muted mt-2 text-xs leading-relaxed">
            Every company, plan and benefit here is created by you — nothing is preloaded.
          </p>
        </div>
      </div>
    </div>
  );
}

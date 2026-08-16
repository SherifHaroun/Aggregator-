import { NavLink } from 'react-router-dom';
import { NAV_SECTIONS } from '@/config/navigation';
import { cn } from '@/lib/cn';

/** Renders whatever `NAV_SECTIONS` describes — no hardcoded links. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-6 px-3 py-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="text-content-subtle px-3 pb-2 text-xs font-semibold tracking-wide uppercase">
            {section.title}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) =>
              item.available ? (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-(--radius-control) px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-brand-soft text-brand-strong font-medium'
                          : 'text-content-muted hover:bg-surface-muted hover:text-content',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ) : (
                <li key={item.to}>
                  <span
                    className="text-content-subtle flex cursor-default items-center justify-between rounded-(--radius-control) px-3 py-2 text-sm"
                    title="Not available yet"
                  >
                    {item.label}
                    <span className="text-content-subtle text-[10px] tracking-wide uppercase">
                      soon
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}

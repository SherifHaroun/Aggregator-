import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight } from './icons';

export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Page title block with an optional breadcrumb trail.
 *
 * The trail is what keeps the drill-down (Companies -> Company -> Plan ->
 * Configuration) feeling like one workflow instead of separate screens.
 *
 * `title` is optional so a screen whose heading lives inside its own panel can
 * still show the trail above it — the trail is about where you are, not about
 * what the page is called.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  media,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Optional leading visual, e.g. a company logo. */
  media?: ReactNode;
}) {
  return (
    <header className={title ? 'mb-6 sm:mb-8' : 'mb-4'}>
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="text-content-subtle flex flex-wrap items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <IconChevronRight className="size-3.5 shrink-0" /> : null}
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-content transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-content-muted">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {/* Trail only, when the heading belongs to a panel further down. */}
      {title || description || media || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {media}
            <div className="min-w-0">
              {title ? (
                <h1 className="text-content text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
              ) : null}
              {description ? (
                <p className="text-content-muted mt-1.5 max-w-2xl text-sm sm:text-[0.95rem]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </header>
  );
}

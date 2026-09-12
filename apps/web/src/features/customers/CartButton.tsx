import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconCart, IconChevronRight, describeError } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { CartItemList } from './CartItemList';
import { useCartSummary } from './customers.api';
import { initials } from './initials';

/**
 * THE CART, IN THE CORNER.
 *
 * The number above the icon is how many comparisons are waiting across every
 * customer. Opening it lists the customers with something in their cart —
 * each in a card of their own, with a gap between, so two callers are never
 * read as one; opening a customer spreads their comparisons out first to
 * last, with the date each was kept, and the same controls the customer's
 * own page has — remove, link, note.
 */
export function CartButton({ className }: { className?: string }) {
  const summary = useCartSummary();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  /* Close on navigation: a link inside the panel leads somewhere, and the
     panel over the new page would be in the way. */
  useEffect(() => setOpen(false), [pathname]);

  /* Close on a click anywhere else, or Escape. */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const total = summary.data?.totalItems ?? 0;
  const customers = summary.data?.customers ?? [];

  return (
    <div ref={container} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Customer cart, ${total} ${total === 1 ? 'comparison' : 'comparisons'}`}
        className={cn(
          'border-border-subtle bg-surface text-content-muted hover:border-border-strong hover:text-content relative flex size-11 items-center justify-center rounded-(--radius-control) border shadow-(--shadow-card) transition-colors',
          open && 'border-brand text-brand',
        )}
      >
        <IconCart className="size-5" />
        {/*
          The count sits above the icon, as a badge on a cart does. Drawn only
          once the carts have been read: an unknown count must not read as
          zero, which is the difference between "nothing waiting" and "the
          server did not answer".
        */}
        {summary.data ? (
          <span
            aria-hidden
            data-testid="cart-count"
            className={cn(
              'absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold tabular-nums',
              total > 0 ? 'bg-brand text-content-inverted' : 'bg-surface-muted text-content-subtle',
            )}
          >
            {total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Customer carts"
          className="border-border-subtle bg-surface absolute top-full right-0 z-40 mt-2 w-[min(92vw,34rem)] rounded-(--radius-card) border shadow-(--shadow-raised)"
        >
          <div className="border-border-subtle flex items-center justify-between border-b px-4 py-3">
            <p className="text-content text-sm font-semibold">
              Customer carts
              <span className="text-content-subtle ml-2 font-normal">
                {total} {total === 1 ? 'comparison' : 'comparisons'}
              </span>
            </p>
            <Link
              to={ROUTES.customers.list}
              className="text-brand-strong inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              All customers
              <IconChevronRight className="size-4" />
            </Link>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-2">
            {summary.isPending ? (
              <p className="text-content-subtle px-2 py-4 text-sm">Loading…</p>
            ) : summary.error ? (
              <p role="alert" className="text-danger px-2 py-4 text-sm">
                {describeError(summary.error, 'the carts')}
              </p>
            ) : customers.length === 0 ? (
              <p className="text-content-subtle px-2 py-6 text-center text-sm">
                No comparisons are waiting. Choose a customer, run a comparison and press “Add to
                cart”.
              </p>
            ) : (
              <ul className="space-y-2 p-1">
                {customers.map((customer) => {
                  const expanded = customer.id === expandedId;
                  return (
                    <li
                      key={customer.id}
                      className={cn(
                        'rounded-(--radius-card) border transition-colors',
                        expanded
                          ? 'border-brand-border bg-brand-soft/30'
                          : 'border-border-subtle bg-surface',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : customer.id)}
                        aria-expanded={expanded}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-(--radius-card) px-3 py-3 text-left text-sm transition-colors',
                          !expanded && 'hover:bg-surface-muted',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            expanded
                              ? 'bg-brand text-content-inverted'
                              : 'bg-brand-soft text-brand-strong',
                          )}
                        >
                          {initials(customer.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="text-content block truncate font-semibold">
                            {customer.name}
                          </span>
                          {customer.phone || customer.email ? (
                            <span className="text-content-subtle block truncate text-xs">
                              {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-content-subtle flex shrink-0 items-center gap-2 text-xs tabular-nums">
                          {customer.items.length}{' '}
                          {customer.items.length === 1 ? 'comparison' : 'comparisons'}
                          <IconChevronRight
                            className={cn('size-4 transition-transform', expanded && 'rotate-90')}
                          />
                        </span>
                      </button>

                      {expanded ? (
                        <div className="border-border-subtle border-t px-3 pt-3 pb-3">
                          <CartItemList
                            customerId={customer.id}
                            customerName={customer.name}
                            items={customer.items}
                            compact
                          />
                          <Link
                            to={ROUTES.customers.detail(customer.id)}
                            className="text-brand-strong mt-2 inline-flex items-center gap-1 px-1 text-sm font-semibold hover:underline"
                          >
                            Open {customer.name}’s page
                            <IconChevronRight className="size-4" />
                          </Link>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

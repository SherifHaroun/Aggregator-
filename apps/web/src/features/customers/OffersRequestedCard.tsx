import { Link } from 'react-router-dom';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  IconCart,
  IconCheck,
  IconChevronRight,
  describeError,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/cn';
import { useCartSummary } from './customers.api';
import { initials } from './initials';
import { offerUrl } from './offers';

/** How many customers the dashboard card lists before pointing at the rest. */
const PREVIEW_ROWS = 6;

/**
 * OFFERS REQUESTED, ON THE DASHBOARD.
 *
 * The count of customers with a plan in their cart — kept by the customer on
 * the website or by an employee on a call, it is the same cart — and who
 * they are: name, the company they buy for, how many plans are waiting, and
 * whether they have linked one. Every part of the card leads to the full
 * page, where each customer is spread out with their details and their
 * plans.
 */
export function OffersRequestedCard() {
  const summary = useCartSummary();
  const customers = summary.data?.customers ?? [];
  const totalItems = summary.data?.totalItems ?? 0;
  const preview = customers.slice(0, PREVIEW_ROWS);
  const rest = customers.length - preview.length;

  return (
    <Card data-testid="offers-requested">
      <CardHeader
        title="Offers requested"
        description="Customers with plans in their cart, whether they kept them on the website or an employee kept them on a call."
        icon={<IconCart className="size-5" />}
        action={
          <ButtonLink to={ROUTES.offers.list} variant="secondary" size="sm">
            See all offers
            <IconChevronRight className="size-4" />
          </ButtonLink>
        }
      />
      <CardBody>
        {/*
          The headline count is a link to the same page: the card IS the
          control. Drawn only once the carts have been read — an unknown
          count must not read as zero.
        */}
        <Link
          to={ROUTES.offers.list}
          aria-label={
            summary.data
              ? `${customers.length} ${customers.length === 1 ? 'customer has' : 'customers have'} requested an offer`
              : 'Offers requested'
          }
          className="hover:bg-surface-muted -mx-2 flex items-baseline gap-3 rounded-(--radius-control) px-2 py-1 transition-colors"
        >
          <span className="text-content text-3xl font-bold tabular-nums">
            {summary.data ? customers.length : <span className="text-content-subtle">—</span>}
          </span>
          <span className="text-content-muted text-sm">
            {customers.length === 1 ? 'customer' : 'customers'}
            {summary.data ? (
              <>
                {' '}
                · {totalItems} {totalItems === 1 ? 'plan' : 'plans'} in carts
              </>
            ) : null}
          </span>
        </Link>

        {summary.isPending ? (
          <p className="text-content-subtle mt-3 text-sm">Loading…</p>
        ) : summary.error ? (
          <p role="alert" className="text-danger mt-3 text-sm">
            {describeError(summary.error, 'the offers')}
          </p>
        ) : customers.length === 0 ? (
          <p className="text-content-subtle border-border-subtle mt-3 rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-sm">
            Nobody has a plan in their cart yet. Offers appear here the moment a customer keeps a
            plan on the website or an employee keeps one for them.
          </p>
        ) : (
          <ul
            aria-label="Customers with offers requested"
            className="mt-3 divide-y divide-(--color-border-subtle)"
          >
            {preview.map((customer) => {
              const linked = customer.items.find((item) => item.isChosen) ?? null;
              return (
                <li key={customer.id}>
                  <Link
                    to={offerUrl(customer.id)}
                    className="hover:bg-surface-muted -mx-2 flex items-center gap-3 rounded-(--radius-control) px-2 py-2.5 text-sm transition-colors"
                  >
                    <span
                      aria-hidden
                      className="bg-brand-soft text-brand-strong flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    >
                      {initials(customer.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-content block truncate font-semibold">
                        {customer.name}
                      </span>
                      <span className="text-content-subtle block truncate text-xs">
                        {customer.companyName ?? 'No company given'}
                      </span>
                    </span>
                    {linked ? (
                      <Badge tone="success">
                        <IconCheck className="mr-1 size-3.5" />
                        Linked
                      </Badge>
                    ) : null}
                    <span
                      className={cn(
                        'text-content-subtle shrink-0 text-xs tabular-nums',
                        linked && 'hidden sm:inline',
                      )}
                    >
                      {customer.items.length} {customer.items.length === 1 ? 'plan' : 'plans'}
                    </span>
                    <IconChevronRight className="text-content-subtle size-4 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {rest > 0 ? (
          <Link
            to={ROUTES.offers.list}
            className="text-brand-strong mt-2 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            And {rest} more
            <IconChevronRight className="size-4" />
          </Link>
        ) : null}
      </CardBody>
    </Card>
  );
}

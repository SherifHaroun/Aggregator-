import type { CustomerWithCartDto } from '@aggregator/shared';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  DataState,
  IconCart,
  IconCheck,
  IconChevronRight,
  PageHeader,
  SummaryList,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { CartItemList } from '@/features/customers/CartItemList';
import { useCartSummary } from '@/features/customers/customers.api';
import { initials } from '@/features/customers/initials';
import { OFFER_CUSTOMER_PARAM, offerAnchor } from '@/features/customers/offers';

/**
 * OFFERS REQUESTED.
 *
 * Every customer with a plan in their cart, each spread out in full: who
 * they are, the company they buy for, how to reach them, every note written
 * on their plans, the plans themselves first to last, and the one they
 * linked if they have. A cart is a cart whoever filled it — the customer on
 * the website or an employee on a call — so both kinds are here.
 *
 * Each customer's card opens their own page, where they are edited or
 * deleted; this page is for reading the offers side by side.
 */
export function OffersRequestedPage() {
  const summary = useCartSummary();
  const [params] = useSearchParams();
  const wanted = params.get(OFFER_CUSTOMER_PARAM);
  const customers = summary.data?.customers ?? [];

  /* Arrived from one row of the dashboard card: scroll to that customer. */
  useEffect(() => {
    if (!wanted || !summary.data) return;
    document.getElementById(offerAnchor(wanted))?.scrollIntoView?.({ block: 'start' });
  }, [wanted, summary.data]);

  const totalItems = summary.data?.totalItems ?? 0;

  return (
    <>
      <PageHeader
        title="Offers requested"
        description={
          summary.data
            ? customers.length === 0
              ? 'Nobody has a plan in their cart yet.'
              : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'} with ${totalItems} ${totalItems === 1 ? 'plan' : 'plans'} in their carts — kept on the website or by an employee, it is the same cart.`
            : 'Every customer with a plan in their cart, in full.'
        }
        breadcrumbs={[{ label: 'Dashboard', to: ROUTES.dashboard }, { label: 'Offers requested' }]}
        actions={
          <ButtonLink to={ROUTES.customers.list} variant="secondary">
            All customers
            <IconChevronRight className="size-4" />
          </ButtonLink>
        }
      />

      <DataState
        isLoading={summary.isLoading}
        error={summary.error}
        data={summary.data ? customers : undefined}
        subject="the offers"
        onRetry={() => void summary.refetch()}
        empty={{
          title: 'No offers requested yet',
          description:
            'Offers appear here the moment a customer keeps a plan on the website or an employee keeps one for them.',
          action: (
            <ButtonLink to={ROUTES.comparison.new}>
              <IconCart className="size-4" />
              Start a comparison
            </ButtonLink>
          ),
        }}
      >
        {(items) => (
          <div className="space-y-5">
            {items.map((customer) => (
              <OfferCard
                key={customer.id}
                customer={customer}
                highlighted={customer.id === wanted}
              />
            ))}
          </div>
        )}
      </DataState>
    </>
  );
}

/** One customer, everything about their request, and the door to their record. */
function OfferCard({
  customer,
  highlighted,
}: {
  customer: CustomerWithCartDto;
  highlighted: boolean;
}) {
  const linked = customer.items.find((item) => item.isChosen) ?? null;
  const notes = customer.items.filter((item) => item.note);

  return (
    <Card
      id={offerAnchor(customer.id)}
      data-testid="offer"
      className={highlighted ? 'ring-brand-border ring-2' : undefined}
    >
      <CardHeader
        title={customer.name}
        description={customer.companyName ?? 'No company given'}
        icon={<span className="text-xs font-bold">{initials(customer.name)}</span>}
        action={
          <ButtonLink to={ROUTES.customers.detail(customer.id)} variant="secondary">
            Go to customer data
            <IconChevronRight className="size-4" />
          </ButtonLink>
        }
      />
      <CardBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <SummaryList
            items={[
              { label: 'Name', value: customer.name },
              { label: 'Company', value: customer.companyName ?? 'Not given' },
              { label: 'Phone number', value: customer.phone ?? 'Not given' },
              { label: 'Email', value: customer.email ?? 'Not given' },
              {
                label: 'Notes',
                value:
                  notes.length === 0 ? (
                    'No notes'
                  ) : (
                    <ul className="space-y-1">
                      {notes.map((item) => (
                        <li key={item.id} className="whitespace-pre-line">
                          <span className="text-content-subtle">{item.name}: </span>
                          {item.note}
                        </li>
                      ))}
                    </ul>
                  ),
              },
              {
                label: 'Linked plan',
                value: linked ? (
                  <Badge tone="success">
                    <IconCheck className="mr-1 size-3.5" />
                    {linked.name}
                  </Badge>
                ) : (
                  'Not yet'
                ),
              },
            ]}
          />

          <div>
            <h3 className="text-content mb-3 text-sm font-semibold">
              Plans in the cart
              <span className="text-content-subtle ml-2 font-normal tabular-nums">
                {customer.items.length}
              </span>
            </h3>
            <CartItemList
              customerId={customer.id}
              customerName={customer.name}
              items={customer.items}
              compact
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

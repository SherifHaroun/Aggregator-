import type { CustomerDto } from '@aggregator/shared';
import { useState } from 'react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DataState,
  IconAdd,
  IconCart,
  IconCheck,
  IconChevronRight,
  Input,
  PageHeader,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { CustomerFormDialog } from '@/features/customers/CustomerFormDialog';
import { useCustomers } from '@/features/customers/customers.api';
import { initials } from '@/features/customers/initials';

/**
 * EVERYBODY WHO RANG IN.
 *
 * One card per customer, with how many comparisons are waiting in their cart
 * and whether they have settled on one. Opening a customer is opening their
 * cart. The search reaches the number and the address as well as the name,
 * because a caller is as likely to be found by the number they rang from.
 */
export function CustomersPage() {
  const [search, setSearch] = useState('');
  const customers = useCustomers(search.trim());
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Customers"
        description="The people comparisons are run for. Each one has a cart of the comparisons kept for them until they choose."
        breadcrumbs={[{ label: 'Dashboard', to: ROUTES.dashboard }, { label: 'Customers' }]}
        actions={
          <Button onClick={() => setAdding(true)}>
            <IconAdd className="size-4" />
            Add customer
          </Button>
        }
      />

      <div className="mb-5 max-w-sm">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, phone or email…"
          aria-label="Search customers"
        />
      </div>

      <DataState
        isLoading={customers.isLoading}
        error={customers.error}
        data={customers.data}
        subject="customers"
        onRetry={() => void customers.refetch()}
        empty={{
          title: search.trim() ? `No customer matches “${search.trim()}”` : 'No customers yet',
          description: search.trim()
            ? 'Try a different search term.'
            : 'Add the first caller, then keep the comparisons you run for them in their cart.',
          action: search.trim() ? undefined : (
            <Button onClick={() => setAdding(true)}>
              <IconAdd className="size-4" />
              Add customer
            </Button>
          ),
        }}
      >
        {(list) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        )}
      </DataState>

      {adding ? <CustomerFormDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function CustomerCard({ customer }: { customer: CustomerDto }) {
  return (
    <Card className="hover:border-brand-border flex h-full flex-col p-5 transition-colors">
      <div className="flex items-start gap-3">
        <span className="bg-brand-soft text-brand-strong flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
          {initials(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-content truncate text-base font-semibold">{customer.name}</p>
          <p className="text-content-muted mt-0.5 truncate text-sm">
            {[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={customer.cartCount > 0 ? 'brand' : 'neutral'}>
            <IconCart className="mr-1 size-3.5" />
            {customer.cartCount === 0 ? 'Empty cart' : `${customer.cartCount} in cart`}
          </Badge>
          {customer.chosenItemId ? (
            <Badge tone="success">
              <IconCheck className="mr-1 size-3.5" />
              Plan linked
            </Badge>
          ) : null}
        </div>
        <ButtonLink size="sm" variant="secondary" to={ROUTES.customers.detail(customer.id)}>
          View cart
          <IconChevronRight className="size-4" />
        </ButtonLink>
      </div>
    </Card>
  );
}

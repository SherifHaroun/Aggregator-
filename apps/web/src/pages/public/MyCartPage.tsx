import { ButtonLink, DataState, IconChevronRight } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { CartItemList } from '@/features/customers/CartItemList';
import { useCustomer } from '@/features/customers/customers.api';

/**
 * WHAT THE CUSTOMER KEPT.
 *
 * Their plans, numbered first to last with the date each was saved, and the
 * controls that are theirs: open the plan again, drop it, or mark the one
 * they want — which the broker sees as the plan this customer chose.
 */
export function MyCartPage() {
  const me = useCustomer('me');
  const data = me.data;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-brand-strong text-xs font-bold tracking-[0.2em] uppercase">My cart</p>
          <h1 className="text-content mt-1 text-3xl font-extrabold tracking-tight">
            {data ? `${data.name}’s plans` : 'Your plans'}
          </h1>
          <p className="text-content-muted mt-1 text-sm">
            {data
              ? data.cartCount === 0
                ? 'Nothing saved yet.'
                : `${data.cartCount} ${data.cartCount === 1 ? 'plan' : 'plans'} saved. Choose the one you want and a Hadbrok adviser will call you.`
              : ''}
          </p>
        </div>
        <ButtonLink variant="secondary" to={`${ROUTES.home}#compare`}>
          Compare more plans
          <IconChevronRight className="size-4" />
        </ButtonLink>
      </div>

      <DataState
        isLoading={me.isLoading}
        error={me.error}
        data={data ? [data] : []}
        subject="your cart"
        onRetry={() => void me.refetch()}
        empty={{ title: 'Your cart is empty' }}
      >
        {() =>
          data ? (
            <CartItemList
              customerId="me"
              customerName={data.name}
              items={data.items}
              audience="customer"
            />
          ) : null
        }
      </DataState>
    </div>
  );
}

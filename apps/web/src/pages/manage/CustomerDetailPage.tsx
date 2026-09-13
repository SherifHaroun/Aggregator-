import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataState,
  IconCart,
  IconCheck,
  IconEdit,
  IconTrash,
  PageHeader,
  SummaryList,
  describeError,
  useToast,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { CartItemList } from '@/features/customers/CartItemList';
import { CustomerFormDialog } from '@/features/customers/CustomerFormDialog';
import { useCustomer, useDeleteCustomer } from '@/features/customers/customers.api';

/**
 * ONE CUSTOMER, AND THEIR CART.
 *
 * Who they are and how to reach them, then every comparison kept for them,
 * first to last, with the date, the note, and the controls: link the one
 * they chose, remove the ones they did not, open any of them again.
 */
export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const customer = useCustomer(customerId);
  const remove = useDeleteCustomer();

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const data = customer.data;
  const chosen = data?.items.find((item) => item.isChosen) ?? null;

  function deleteCustomer() {
    if (!data) return;
    remove.mutate(data.id, {
      onSuccess: () => {
        notify(`${data.name} was deleted.`);
        navigate(ROUTES.customers.list);
      },
      onError: (error) => {
        notify(describeError(error, 'the customer'), 'error');
        setConfirmingDelete(false);
      },
    });
  }

  return (
    <>
      <PageHeader
        title={data?.name ?? 'Customer'}
        description={
          data
            ? data.cartCount === 0
              ? 'Nothing in the cart yet.'
              : `${data.cartCount} ${data.cartCount === 1 ? 'comparison' : 'comparisons'} in the cart${chosen ? ` · linked to ${chosen.name}` : ''}.`
            : undefined
        }
        breadcrumbs={[
          { label: 'Dashboard', to: ROUTES.dashboard },
          { label: 'Customers', to: ROUTES.customers.list },
          { label: data?.name ?? '…' },
        ]}
        actions={
          data ? (
            <>
              <ButtonLink to={`${ROUTES.comparison.new}?customerId=${encodeURIComponent(data.id)}`}>
                <IconCart className="size-4" />
                New comparison
              </ButtonLink>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <IconEdit className="size-4" />
                Edit customer
              </Button>
              <Button
                variant="ghost"
                className="text-danger hover:text-danger"
                onClick={() => setConfirmingDelete(true)}
              >
                <IconTrash className="size-4" />
                Delete
              </Button>
            </>
          ) : undefined
        }
      />

      <DataState
        isLoading={customer.isLoading}
        error={customer.error}
        data={data ? [data] : []}
        subject="the customer"
        onRetry={() => void customer.refetch()}
        empty={{
          title: 'Customer not found',
          description: 'They may have been deleted.',
        }}
      >
        {() =>
          data ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
              <Card className="h-fit">
                <CardHeader title="Details" />
                <CardBody>
                  <SummaryList
                    items={[
                      { label: 'Name', value: data.name },
                      { label: 'Phone number', value: data.phone ?? 'Not given' },
                      { label: 'Email', value: data.email ?? 'Not given' },
                      { label: 'Company', value: data.companyName ?? 'Not given' },
                      {
                        label: 'Chosen plan',
                        value: chosen ? (
                          <Badge tone="success">
                            <IconCheck className="mr-1 size-3.5" />
                            {chosen.name}
                          </Badge>
                        ) : (
                          'Not yet'
                        ),
                      },
                    ]}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Cart"
                  description="Every comparison kept for this customer, first to last. Link the one they choose."
                  icon={<IconCart className="size-5" />}
                />
                <CardBody>
                  <CartItemList customerId={data.id} customerName={data.name} items={data.items} />
                </CardBody>
              </Card>
            </div>
          ) : null
        }
      </DataState>

      {editing && data ? (
        <CustomerFormDialog customer={data} onClose={() => setEditing(false)} />
      ) : null}

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={deleteCustomer}
        title={`Delete ${data?.name ?? 'this customer'}?`}
        description="Their cart goes with them. This cannot be undone."
        busy={remove.isPending}
      />
    </>
  );
}

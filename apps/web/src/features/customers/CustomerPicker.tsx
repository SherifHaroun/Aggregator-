import type { CustomerDto } from '@aggregator/shared';
import { useMemo, useState } from 'react';
import {
  Button,
  Callout,
  Field,
  IconAdd,
  IconCheck,
  IconUsers,
  Input,
  describeError,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCreateCustomer, useCustomer, useCustomers } from './customers.api';
import { initials } from './initials';

/**
 * WHO THE COMPARISON IS FOR — chosen before it is run.
 *
 * The employee is on a call. They find the caller by name, number or email,
 * or write a new one down without leaving the form, and everything that
 * follows — the results, the plan pages, "Add to cart" — belongs to that
 * customer. Once chosen, the customer is shown as a card with a Change
 * button, so the rest of the form is not crowded by a list.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
}: {
  /** The chosen customer's id, or nothing yet. */
  value: string | null;
  onChange: (customerId: string | null) => void;
  /** Shown when the form was submitted without a customer. */
  error?: string | null;
}) {
  const chosen = useCustomer(value ?? undefined);

  if (value && chosen.data) {
    return <ChosenCustomer customer={chosen.data} onChange={() => onChange(null)} />;
  }
  if (value && chosen.isPending) {
    return (
      <div className="border-border-subtle rounded-(--radius-card) border p-4">
        <p className="text-content-subtle text-sm">Loading the customer…</p>
      </div>
    );
  }

  return (
    <ChooseCustomer
      onChosen={onChange}
      error={
        error ??
        (value && chosen.error
          ? 'That customer could not be found. Choose another, or add a new one.'
          : null)
      }
    />
  );
}

function ChosenCustomer({ customer, onChange }: { customer: CustomerDto; onChange: () => void }) {
  return (
    <div className="border-brand-border bg-brand-soft/50 flex flex-wrap items-center gap-3 rounded-(--radius-card) border p-4">
      <span className="bg-brand text-content-inverted flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
        {initials(customer.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-content-subtle text-xs font-semibold tracking-wide uppercase">
          Comparing for
        </p>
        <p className="text-content truncate text-base font-semibold">{customer.name}</p>
        <p className="text-content-muted truncate text-sm">
          {[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details'}
          {customer.cartCount > 0
            ? ` · ${customer.cartCount} ${customer.cartCount === 1 ? 'comparison' : 'comparisons'} in cart`
            : ''}
        </p>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onChange}>
        Change customer
      </Button>
    </div>
  );
}

function ChooseCustomer({
  onChosen,
  error,
}: {
  onChosen: (customerId: string) => void;
  error: string | null;
}) {
  const [search, setSearch] = useState('');
  const customers = useCustomers();
  const create = useCreateCustomer();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = customers.data ?? [];
    if (!needle) return list;
    return list.filter((customer) =>
      [customer.name, customer.phone ?? '', customer.email ?? ''].some((text) =>
        text.toLowerCase().includes(needle),
      ),
    );
  }, [customers.data, search]);

  function saveNewCustomer() {
    const name = newName.trim();
    if (name === '') {
      setCreateError('Enter the new customer’s name.');
      return;
    }
    setCreateError(null);
    create.mutate(
      { name, phone: newPhone.trim() || null, email: newEmail.trim() || null },
      {
        onSuccess: (created) => onChosen(created.id),
        onError: (failure) => setCreateError(describeError(failure, 'the customer')),
      },
    );
  }

  return (
    <fieldset
      className={cn(
        'rounded-(--radius-card) border p-4 sm:p-5',
        error ? 'border-danger' : 'border-border-subtle',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <legend className="text-content flex items-center gap-2 text-sm font-semibold">
          <IconUsers className="text-brand size-4" />
          Who is this comparison for?
        </legend>
        <button
          type="button"
          onClick={() => {
            setCreating((current) => !current);
            setCreateError(null);
          }}
          className="text-brand-strong inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          <IconAdd className="size-4" />
          {creating ? 'Choose an existing customer' : 'New customer'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-danger mb-3 text-sm">
          {error}
        </p>
      ) : null}

      {creating ? (
        <div className="space-y-3">
          {createError ? (
            <Callout tone="danger" title="Could not add the customer">
              {createError}
            </Callout>
          ) : null}
          <Field label="Name" required>
            {(props) => (
              <Input
                {...props}
                autoFocus
                value={newName}
                placeholder="e.g. Mona Adel"
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    saveNewCustomer();
                  }
                }}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone number" hint="Optional.">
              {(props) => (
                <Input
                  {...props}
                  type="tel"
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                />
              )}
            </Field>
            <Field label="Email" hint="Optional.">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              )}
            </Field>
          </div>
          <Button type="button" onClick={saveNewCustomer} disabled={create.isPending}>
            <IconCheck className="size-4" />
            {create.isPending ? 'Saving…' : 'Save and use this customer'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            type="search"
            aria-label="Search customers"
            placeholder="Search by name, phone or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {customers.isPending ? (
            <p className="text-content-subtle px-1 py-2 text-sm">Loading customers…</p>
          ) : customers.error ? (
            <p role="alert" className="text-danger px-1 py-2 text-sm">
              {describeError(customers.error, 'the customers')}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-content-subtle border-border-subtle rounded-(--radius-control) border border-dashed px-3 py-5 text-center text-sm">
              {customers.data?.length
                ? `No customer matches “${search}”.`
                : 'No customers yet. Press “New customer” to write the caller down.'}
            </p>
          ) : (
            <ul
              role="radiogroup"
              aria-label="Customers"
              className="border-border-subtle max-h-56 divide-y overflow-y-auto rounded-(--radius-control) border"
            >
              {visible.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={false}
                    onClick={() => onChosen(customer.id)}
                    className="hover:bg-surface-muted text-content flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors"
                  >
                    <span className="bg-brand-soft text-brand-strong flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {initials(customer.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{customer.name}</span>
                      {customer.phone || customer.email ? (
                        <span className="text-content-subtle block truncate text-xs">
                          {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-content-subtle shrink-0 text-xs tabular-nums">
                      {customer.cartCount === 0 ? 'Empty cart' : `${customer.cartCount} in cart`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </fieldset>
  );
}

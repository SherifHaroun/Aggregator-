import {
  presentPremium,
  type ComparisonPlanResult,
  type ComparisonRequestInput,
} from '@aggregator/shared';
import { useMemo, useState } from 'react';
import {
  Button,
  Callout,
  Dialog,
  Field,
  IconAdd,
  Input,
  Select,
  Textarea,
  describeError,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAddCartItem, useCreateCustomer, useCustomers } from './customers.api';

/**
 * ADD A COMPARISON TO A CUSTOMER'S CART.
 *
 * Opened from the results: pick the customer, say which of the plans the
 * comparison is being kept with — the recommended one unless the employee
 * says otherwise — write a note if there is one, and press Add. The entry
 * is named by the system ("Arope SME 1") and dated when it lands.
 *
 * A caller who is not on the list yet is added from here, so the call is
 * never interrupted to go and create them first.
 */
export function AddToCartDialog({
  plans,
  criteria,
  defaultPlanId,
  onClose,
}: {
  /** Every plan in the results, best value first. */
  plans: ComparisonPlanResult[];
  /** The selection the comparison was run from. */
  criteria: ComparisonRequestInput;
  /** Which plan to offer first — the one the employee was looking at. */
  defaultPlanId?: string | null;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const customers = useCustomers();
  const addItem = useAddCartItem();
  const createCustomer = useCreateCustomer();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [planId, setPlanId] = useState(
    defaultPlanId ??
      plans.find((plan) => plan.isRecommended)?.configurationId ??
      plans[0]?.configurationId ??
      '',
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Adding a caller who is not on the list, without leaving the dialog. */
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

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

  const busy = addItem.isPending || createCustomer.isPending;

  async function submit() {
    setError(null);
    if (!planId) {
      setError('Choose the plan to keep this comparison with.');
      return;
    }

    let targetId = customerId;
    if (creating) {
      const name = newName.trim();
      if (name === '') {
        setError('Enter the new customer’s name.');
        return;
      }
      try {
        const created = await createCustomer.mutateAsync({
          name,
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
        });
        targetId = created.id;
      } catch (failure) {
        setError(describeError(failure, 'the customer'));
        return;
      }
    }
    if (!targetId) {
      setError('Choose a customer, or add a new one.');
      return;
    }

    addItem.mutate(
      { customerId: targetId, planConfigurationId: planId, criteria, note: note.trim() || null },
      {
        onSuccess: (item) => {
          notify(`${item.name} was added to the customer’s cart.`);
          onClose();
        },
        onError: (failure) => setError(describeError(failure, 'the cart')),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add to customer cart"
      description="Keep this comparison for a customer until they decide. It is named for the insurer and section, and numbered."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error ? (
          <Callout tone="danger" title="Could not add to the cart">
            {error}
          </Callout>
        ) : null}

        {/* --- who -------------------------------------------------------- */}
        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-3">
            <legend className="text-content text-sm font-medium">Customer</legend>
            <button
              type="button"
              onClick={() => {
                setCreating((current) => !current);
                setCustomerId(null);
              }}
              className="text-brand-strong inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              <IconAdd className="size-4" />
              {creating ? 'Choose an existing customer' : 'New customer'}
            </button>
          </div>

          {creating ? (
            <div className="space-y-3">
              <Field label="Name" required>
                {(props) => (
                  <Input
                    {...props}
                    autoFocus
                    value={newName}
                    placeholder="e.g. Mona Adel"
                    onChange={(event) => setNewName(event.target.value)}
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
                    : 'No customers yet. Press “New customer” to add the caller.'}
                </p>
              ) : (
                <ul
                  role="radiogroup"
                  aria-label="Customers"
                  className="border-border-subtle max-h-52 divide-y overflow-y-auto rounded-(--radius-control) border"
                >
                  {visible.map((customer) => {
                    const selected = customer.id === customerId;
                    return (
                      <li key={customer.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setCustomerId(customer.id)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                            selected
                              ? 'bg-brand-soft text-brand-strong'
                              : 'hover:bg-surface-muted text-content',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{customer.name}</span>
                            {customer.phone || customer.email ? (
                              <span className="text-content-subtle block truncate text-xs">
                                {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-content-subtle shrink-0 text-xs tabular-nums">
                            {customer.cartCount === 0
                              ? 'Empty cart'
                              : `${customer.cartCount} in cart`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </fieldset>

        {/* --- which plan ------------------------------------------------- */}
        <Field
          label="Plan"
          hint="The plan this comparison is kept with. The recommended one is offered first."
        >
          {(props) => (
            <Select {...props} value={planId} onChange={(event) => setPlanId(event.target.value)}>
              {plans.map((plan) => (
                <option key={plan.configurationId} value={plan.configurationId}>
                  {plan.companyName} · {plan.planName} · {presentPremium(plan)}
                  {plan.isRecommended ? ' (recommended)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* --- the note --------------------------------------------------- */}
        <Field label="Note" hint="Optional. Shown under the name when the cart is opened.">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={note}
              placeholder="e.g. Wants a private room; call back Thursday."
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

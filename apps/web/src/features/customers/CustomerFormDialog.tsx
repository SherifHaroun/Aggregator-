import type { CustomerDto } from '@aggregator/shared';
import { useState } from 'react';
import { Button, Callout, Dialog, Field, Input, describeError, useToast } from '@/components/ui';
import { useCreateCustomer, useSaveCustomer } from './customers.api';

/**
 * A caller, written down.
 *
 * Only the name is required: someone who rings with a question may leave no
 * number and no address, and a form that refused them until they did would
 * lose the call. The same dialog edits an existing customer.
 */
export function CustomerFormDialog({
  customer,
  onClose,
  onSaved,
}: {
  /** Absent when adding. */
  customer?: CustomerDto;
  onClose: () => void;
  onSaved?: (saved: CustomerDto) => void;
}) {
  const create = useCreateCustomer();
  const save = useSaveCustomer(customer?.id ?? '');
  const mutation = customer ? save : create;
  const { notify } = useToast();

  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Enter the customer’s name.');
      return;
    }
    mutation.mutate(
      { name: trimmed, phone: phone.trim() || null, email: email.trim() || null },
      {
        onSuccess: (saved) => {
          notify(customer ? `${saved.name} was updated.` : `${saved.name} was added.`);
          onSaved?.(saved);
          onClose();
        },
        onError: (failure) => setError(describeError(failure, 'the customer')),
      },
    );
  }

  const onEnter = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={customer ? 'Edit customer' : 'Add a customer'}
      description="The name is all that is needed. Add a number or an email when the customer gives one."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Callout tone="danger" title="Could not save the customer">
            {error}
          </Callout>
        ) : null}
        <Field label="Name" required>
          {(props) => (
            <Input
              {...props}
              autoFocus
              value={name}
              placeholder="e.g. Mona Adel"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={onEnter}
            />
          )}
        </Field>
        <Field label="Phone number" hint="Optional.">
          {(props) => (
            <Input
              {...props}
              type="tel"
              value={phone}
              placeholder="e.g. 0100 123 4567"
              onChange={(event) => setPhone(event.target.value)}
              onKeyDown={onEnter}
            />
          )}
        </Field>
        <Field label="Email" hint="Optional.">
          {(props) => (
            <Input
              {...props}
              type="email"
              value={email}
              placeholder="e.g. mona@example.com"
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={onEnter}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

import { useState } from 'react';
import { Button, Callout, Dialog, Field, Input, useToast } from '@/components/ui';
import { useCreateInsuranceOption } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Create a benefit.
 *
 * A benefit is a name, nothing more: the API gives every new one the percentage
 * value it carries, so there is no field, type, description or status for the
 * employee to configure. It is GLOBAL — once saved it appears in the available
 * list of every company and every plan, and can be dragged onto any of them.
 */
export function NewBenefitDialog({ onClose }: { onClose: () => void }) {
  const { notify } = useToast();
  const create = useCreateInsuranceOption();
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({ name: '' });
  const [submitted, setSubmitted] = useState(false);

  const name = values.name.trim();

  function submit() {
    setSubmitted(true);
    if (name === '') return;

    create.mutate(
      { name },
      {
        onSuccess: (saved) => {
          notify(`${saved.name} was added to the available benefits.`);
          onClose();
        },
        onError: (error) => applyError(error, 'the benefit'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New benefit"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError ? (
          <Callout tone="danger" title="Could not save">
            {formError}
          </Callout>
        ) : null}

        <Field
          label="Benefit name"
          required
          error={fieldErrors.name ?? (submitted && name === '' ? 'Enter a name.' : undefined)}
        >
          {(props) => (
            <Input
              {...props}
              autoFocus
              value={values.name}
              onChange={(event) => setValue('name', event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Name this benefit"
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

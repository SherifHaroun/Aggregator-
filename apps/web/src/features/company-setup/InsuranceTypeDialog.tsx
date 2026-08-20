import { useState } from 'react';
import { Button, Callout, Dialog, Field, Input, Textarea, useToast } from '@/components/ui';
import { useSaveInsuranceType } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Create an insurance category.
 *
 * The name is the whole requirement — the machine code is derived from it by
 * the API, so nobody has to invent one. A description is offered because this
 * is the screen that lists them, and a category whose meaning is obvious to the
 * person who made it rarely stays obvious to everyone else.
 */
export function InsuranceTypeDialog({ onClose }: { onClose: () => void }) {
  const { notify } = useToast();
  const save = useSaveInsuranceType();
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: '',
    description: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const name = values.name.trim();

  function submit() {
    setSubmitted(true);
    if (name === '') return;

    save.mutate(
      {
        name,
        description: values.description.trim() === '' ? null : values.description.trim(),
      },
      {
        onSuccess: (created) => {
          notify(`${created.name} was added.`);
          onClose();
        },
        onError: (error) => applyError(error, 'the insurance type'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add an insurance type"
      description="A category plans are grouped under, e.g. medical, motor or travel."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Adding…' : 'Add type'}
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
          label="Name"
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
              placeholder="Medical, Motor, Travel…"
            />
          )}
        </Field>

        <Field label="Description" error={fieldErrors.description} hint="Optional.">
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={values.description}
              onChange={(event) => setValue('description', event.target.value)}
              placeholder="What this category covers."
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

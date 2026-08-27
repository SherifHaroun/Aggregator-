import {
  UMBRELLA_BENEFIT_LABEL,
  benefitTypeLabel,
  type InsuranceOptionDto,
} from '@aggregator/shared';
import { useState } from 'react';
import { Button, Callout, Dialog, Field, Input, useToast } from '@/components/ui';
import { useSaveInsuranceOption } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Rename a benefit or a sub-benefit.
 *
 * Only the name is editable, and deliberately so: what the benefit CARRIES —
 * a percentage, a limit, text — and where it sits in a group are what its
 * recorded values were entered against, so changing either would silently
 * invalidate them. A wrong kind is a new benefit, not an edit.
 *
 * The benefit is global, so this renames it on every plan of every company at
 * once. Nothing holds a copy of the name; attachments point at the record.
 */
export function RenameBenefitDialog({
  benefit,
  onClose,
}: {
  benefit: InsuranceOptionDto;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const save = useSaveInsuranceOption(benefit.id);
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: benefit.name,
  });
  const [submitted, setSubmitted] = useState(false);

  const name = values.name.trim();
  const unchanged = name === benefit.name;

  function submit() {
    setSubmitted(true);
    if (name === '') return;
    if (unchanged) {
      onClose();
      return;
    }

    save.mutate(
      { name },
      {
        onSuccess: (saved) => {
          notify(`The benefit is now called ${saved.name}.`);
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
      title="Rename benefit"
      description="It is renamed on every plan of every company that carries it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
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
          hint={
            benefit.isUmbrella
              ? `${UMBRELLA_BENEFIT_LABEL}. What it holds is unchanged.`
              : `Carries: ${benefitTypeLabel(benefit.fields)}. That cannot be changed here.`
          }
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
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

import {
  ALTERNATIVE_VALUE_KEY,
  UMBRELLA_BENEFIT_LABEL,
  type InsuranceOptionDto,
} from '@aggregator/shared';
import { useState } from 'react';
import { Button, Callout, Dialog, Field, Input, useToast } from '@/components/ui';
import {
  useInsuranceOption,
  useSaveInsuranceOption,
} from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';
import { BenefitAnswersEditor } from './BenefitAnswersEditor';

/**
 * Rename a benefit or a sub-benefit.
 *
 * The name is a property of the benefit itself, which is global — so a change
 * here lands on every plan of every company at once. Nothing holds a copy;
 * attachments point at the record.
 *
 * What a benefit carries is not edited here. It was decided when the benefit
 * was created, from its name, and nothing about it is put to the employee.
 * The one exception is a RANKED benefit, whose answers are a list the
 * business orders — that list belongs to the benefit, so it is edited here.
 */
export function EditBenefitDialog({
  benefit,
  onClose,
}: {
  benefit: InsuranceOptionDto;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const save = useSaveInsuranceOption(benefit.id);
  /**
   * The benefit read fresh, so the answers list reflects an add or a reorder
   * made in this dialog without closing and reopening it. The row that opened
   * the dialog is the fallback until it arrives.
   */
  const latest = useInsuranceOption(benefit.id);

  const mainField = benefit.fields?.find((field) => field.key !== ALTERNATIVE_VALUE_KEY);
  const ranked = mainField?.dataType === 'RANK';

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: benefit.name,
  });
  const [submitted, setSubmitted] = useState(false);

  const name = values.name.trim();

  function submit() {
    setSubmitted(true);
    if (name === '') return;
    if (name === benefit.name) {
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
      title="Edit benefit"
      description="Changes land on every plan of every company that carries it."
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
      <div className="space-y-5">
        {formError ? (
          <Callout tone="danger" title="Could not save">
            {formError}
          </Callout>
        ) : null}

        <Field
          label="Benefit name"
          required
          {...(benefit.isUmbrella
            ? { hint: `${UMBRELLA_BENEFIT_LABEL}. What it holds is unchanged.` }
            : {})}
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

        {/* The ordered answers of a ranked benefit belong to the benefit, so
            they are edited here rather than on any one plan. */}
        {ranked && mainField ? (
          <BenefitAnswersEditor
            optionFieldId={mainField.id}
            choices={
              (latest.data?.fields ?? benefit.fields ?? []).find(
                (field) => field.key !== ALTERNATIVE_VALUE_KEY,
              )?.choices ?? []
            }
            ranked
          />
        ) : null}
      </div>
    </Dialog>
  );
}

import {
  BENEFIT_VALUE_KINDS,
  DEFAULT_BENEFIT_VALUE_KIND,
  UMBRELLA_BENEFIT_LABEL,
  benefitKindForDataType,
  listEnabledOptions,
  type BenefitValueKind,
  type InsuranceOptionDto,
} from '@aggregator/shared';
import { useState } from 'react';
import { Button, Callout, ChoiceGroup, Dialog, Field, Input, useToast } from '@/components/ui';
import { useSaveInsuranceOption } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Edit a benefit or a sub-benefit: its name, and what it carries.
 *
 * Both are properties of the benefit itself, which is global — so a change here
 * lands on every plan of every company at once. Nothing holds a copy of either;
 * attachments point at the record.
 *
 * Changing what a benefit carries also moves the values already recorded
 * against it, and the API is the one that moves them. What this dialog owes the
 * employee is the warning: percentage and limit are the same figure so nothing
 * is lost, but a value that cannot survive the new kind is cleared, and it says
 * so before they save rather than after.
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

  /** What it carries today, read from its own field definition. */
  const currentKind = benefit.fields?.[0]
    ? benefitKindForDataType(benefit.fields[0].dataType)
    : null;

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: benefit.name,
    valueKind: (currentKind ?? DEFAULT_BENEFIT_VALUE_KIND) as BenefitValueKind,
  });
  const [submitted, setSubmitted] = useState(false);

  const name = values.name.trim();
  /** A group carries nothing, so there is no kind to offer for one. */
  const carriesValue = !benefit.isUmbrella && currentKind !== null;
  const kindChanged = carriesValue && values.valueKind !== currentKind;
  const nameChanged = name !== benefit.name;

  function submit() {
    setSubmitted(true);
    if (name === '') return;
    if (!nameChanged && !kindChanged) {
      onClose();
      return;
    }

    save.mutate(
      {
        ...(nameChanged ? { name } : {}),
        ...(kindChanged ? { valueKind: values.valueKind } : {}),
      },
      {
        onSuccess: (saved) => {
          notify(
            kindChanged
              ? `${saved.name} now carries ${CARRIES_PHRASE[values.valueKind]}.`
              : `The benefit is now called ${saved.name}.`,
          );
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

        {carriesValue ? (
          <>
            <ChoiceGroup
              name="valueKind"
              legend="What does it carry?"
              hint="Every plan that carries this benefit keeps its figure where the new kind can hold it."
              options={listEnabledOptions(BENEFIT_VALUE_KINDS)}
              value={values.valueKind}
              onChange={(id) => setValue('valueKind', id as BenefitValueKind)}
              error={fieldErrors.valueKind ?? null}
            />

            {kindChanged ? (
              <Callout tone="warning" title="What happens to the values already entered">
                {describeConversion(currentKind!, values.valueKind, benefit.usageCount ?? 0)}
              </Callout>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Reads back in a sentence: "X now carries a limit." / "...carries text." */
const CARRIES_PHRASE: Record<BenefitValueKind, string> = {
  PERCENTAGE: 'a percentage',
  LIMIT: 'a limit',
  TEXT: 'text',
};

/**
 * What the switch does to figures already recorded, in plain terms.
 *
 * Percentage and limit are the same number in the same place, so the only loss
 * is a figure the new kind cannot legally hold. Text is the lossy direction:
 * "Golden Care Network" is not a number and cannot be made into one.
 */
function describeConversion(
  from: BenefitValueKind,
  to: BenefitValueKind,
  usageCount: number,
): string {
  const where =
    usageCount === 0
      ? 'No plan carries this benefit yet, so nothing is affected.'
      : `${usageCount} plan configuration${usageCount === 1 ? '' : 's'} carr${usageCount === 1 ? 'ies' : 'y'} this benefit.`;

  if (to === 'TEXT') {
    return `${where} Each figure is kept, written out as text.`;
  }
  if (from === 'TEXT') {
    return `${where} Anything that reads as a number is kept; wording that does not — a network name, for instance — cannot become a number and is cleared.`;
  }
  if (to === 'PERCENTAGE') {
    return `${where} The figures are kept as they are, except any above 100, which no percentage can hold — those are cleared.`;
  }
  return `${where} The figures are kept exactly as they are.`;
}

import {
  ALTERNATIVE_VALUE_KEY,
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
import { useInsuranceOption, useSaveInsuranceOption } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';
import { AlternativeChoice } from './AlternativeChoice';
import { BenefitAnswersEditor } from './BenefitAnswersEditor';

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
  /**
   * The benefit read fresh, so the answers list reflects an add or a reorder
   * made in this dialog without closing and reopening it. The row that opened
   * the dialog is the fallback until it arrives.
   */
  const latest = useInsuranceOption(benefit.id);

  /** What it carries today, read from its own field definitions. */
  const mainField = benefit.fields?.find((field) => field.key !== ALTERNATIVE_VALUE_KEY);
  const alternativeField = benefit.fields?.find((field) => field.key === ALTERNATIVE_VALUE_KEY);
  const currentKind = mainField ? benefitKindForDataType(mainField.dataType) : null;
  const currentAlternative = alternativeField
    ? benefitKindForDataType(alternativeField.dataType)
    : null;

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: benefit.name,
    valueKind: (currentKind ?? DEFAULT_BENEFIT_VALUE_KIND) as BenefitValueKind,
    alternativeKind: currentAlternative as BenefitValueKind | null,
  });
  const [submitted, setSubmitted] = useState(false);

  const name = values.name.trim();
  /** A group carries nothing, so there is no kind to offer for one. */
  const carriesValue = !benefit.isUmbrella && currentKind !== null;
  const kindChanged = carriesValue && values.valueKind !== currentKind;
  const alternativeChanged = carriesValue && values.alternativeKind !== currentAlternative;
  const nameChanged = name !== benefit.name;
  /** Dropping the alternative drops the figures recorded against it. */
  const alternativeRemoved = currentAlternative !== null && values.alternativeKind === null;

  function submit() {
    setSubmitted(true);
    if (name === '') return;
    if (!nameChanged && !kindChanged && !alternativeChanged) {
      onClose();
      return;
    }

    save.mutate(
      {
        ...(nameChanged ? { name } : {}),
        ...(kindChanged ? { valueKind: values.valueKind } : {}),
        ...(alternativeChanged ? { alternativeKind: values.alternativeKind } : {}),
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

            <AlternativeChoice
              value={values.alternativeKind}
              onChange={(kind) => setValue('alternativeKind', kind)}
            />

            {alternativeRemoved ? (
              <Callout tone="warning" title="Removing the alternative">
                The second value goes, and with it every figure entered against it. The main value
                is untouched.
              </Callout>
            ) : null}

            {/* The list belongs to the benefit, so it is edited here rather than
                on any one plan. Shown for the kinds that use it: ranked cover
                is judged by the order, text cover merely suggests from it. */}
            {values.valueKind === 'RANK' || values.valueKind === 'TEXT' ? (
              <BenefitAnswersEditor
                optionFieldId={mainField?.id ?? ''}
                choices={
                  (latest.data?.fields ?? benefit.fields ?? []).find(
                    (field) => field.key !== ALTERNATIVE_VALUE_KEY,
                  )?.choices ?? []
                }
                ranked={values.valueKind === 'RANK'}
              />
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
  RANK: 'one of its ranked answers',
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

  /**
   * A ranked value is the id of an answer, so it is never a reformatted
   * figure. Leaving RANK keeps the answer's WORDING; arriving at it can keep
   * nothing, because no figure and no free text is one of the answers — and
   * inventing one would put words in the plan's mouth.
   */
  if (to === 'RANK') {
    return `${where} Nothing already entered can become one of the ranked answers, so those values are cleared and each plan picks its answer again.`;
  }
  if (from === 'RANK') {
    return to === 'TEXT'
      ? `${where} Each plan keeps the wording of the answer it gave.`
      : `${where} An answer is a name rather than a number, so those values are cleared.`;
  }

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

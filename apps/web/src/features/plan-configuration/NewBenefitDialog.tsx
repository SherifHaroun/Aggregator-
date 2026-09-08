import { medicalBenefitSpec, type BenefitValueKind } from '@aggregator/shared';
import { useState } from 'react';
import { Button, Callout, Dialog, Field, Input, useToast } from '@/components/ui';
import { useCreateInsuranceOption } from '@/features/insurance-data/insurance-data.api';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Create a benefit. A benefit is a NAME, and nothing else is asked.
 *
 * What it carries is decided for the employee: a name the business already
 * knows — a core area such as Maternity, or one of the standard extras — is
 * quoted the way the business fixed for it, and anything else is TEXT, because
 * an additional benefit is what a plan states in words and is read when
 * somebody opens the plan rather than ranked. Nothing about data types or
 * units is ever put on screen.
 *
 * A benefit may instead be a GROUP, which carries nothing and exists to hold
 * others under it — life and accident cover over death, disability and the
 * rest. Sub-benefits are created through this same dialog with `parent` set,
 * and only one level of nesting exists.
 *
 * Whatever is created is GLOBAL — it appears in the available list of every
 * company and every plan, and can be dragged onto any of them.
 */
export function NewBenefitDialog({
  parent,
  onCreated,
  onClose,
}: {
  /** The umbrella this benefit is being created inside, if any. */
  parent?: { id: string; name: string };
  /** Called with the saved benefit, e.g. so a board can attach it at once. */
  onCreated?: (benefitId: string) => void;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const create = useCreateInsuranceOption();
  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: '',
    isUmbrella: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const name = values.name.trim();
  /** A sub-benefit always carries a value: only the top level can be a group. */
  const isUmbrella = parent ? false : values.isUmbrella;

  function submit() {
    setSubmitted(true);
    if (name === '') return;

    create.mutate(
      {
        name,
        isUmbrella,
        ...(parent ? { parentId: parent.id } : {}),
        ...(isUmbrella ? {} : { valueKind: kindFor(name) }),
      },
      {
        onSuccess: (saved) => {
          notify(
            parent
              ? `${saved.name} was added under ${parent.name}.`
              : `${saved.name} was added to the available benefits.`,
          );
          onCreated?.(saved.id);
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
      title={parent ? `New benefit under ${parent.name}` : 'New benefit'}
      description={
        parent
          ? 'It becomes part of this group everywhere the group is used.'
          : 'Name it. Each plan then says what it covers for it.'
      }
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
      <div className="space-y-5">
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

        {/* Only a top-level benefit can become a group: nesting stops at one. */}
        {parent ? null : (
          <label className="border-border-subtle bg-surface-muted/40 flex cursor-pointer items-start gap-3 rounded-(--radius-control) border p-3">
            <input
              type="checkbox"
              className="accent-brand mt-0.5 size-4"
              checked={values.isUmbrella}
              onChange={(event) => setValue('isUmbrella', event.target.checked)}
            />
            <span>
              <span className="text-content block text-sm font-medium">
                This benefit groups others under it
              </span>
              <span className="text-content-subtle block text-xs leading-snug">
                It carries no value of its own. You add the sub-benefits underneath it.
              </span>
            </span>
          </label>
        )}
      </div>
    </Dialog>
  );
}

/**
 * What a benefit of this name carries.
 *
 * A name the business knows is quoted the way the business fixed — a core area
 * keeps the figure a comparison reads. Anything else is text, so whatever the
 * document says about it can be recorded as written.
 */
function kindFor(name: string): BenefitValueKind {
  return medicalBenefitSpec(name)?.valueKind ?? 'TEXT';
}

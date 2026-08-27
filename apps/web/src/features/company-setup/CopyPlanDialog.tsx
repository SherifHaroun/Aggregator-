import {
  configurationLabel,
  derivePlanCode,
  formatMoney,
  type PlanConfigurationDto,
  type PlanDto,
} from '@aggregator/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Callout, Dialog, Field, Input, Textarea, useToast } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useDuplicatePlan } from '@/features/insurance-data/insurance-data.api';
import { benefitCountLabel } from '@/features/insurance-data/labels';
import { useRecordForm } from '@/features/insurance-data/useRecordForm';

/**
 * Copy a plan, choosing which of its configurations come with it.
 *
 * A company's plans are usually one product priced several ways — the same
 * benefits and the same age bands at different premiums — so the copy carries
 * every selected configuration with its benefits, their values and their notes,
 * and the employee changes only the figures that actually differ.
 *
 * THE NAME MUST CHANGE. Save stays disabled until it does, and the API refuses
 * the request as well: two identically-named plans in one company is how the
 * wrong one gets quoted.
 */
export function CopyPlanDialog({
  companyId,
  plan,
  onClose,
}: {
  companyId: string;
  plan: PlanDto;
  onClose: () => void;
}) {
  const { notify } = useToast();
  const navigate = useNavigate();
  const copy = useDuplicatePlan(plan.id);

  const configurations = plan.configurations ?? [];

  const { values, setValue, fieldErrors, formError, applyError } = useRecordForm({
    name: '',
    code: '',
    description: plan.description ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  /** Everything comes across unless the employee says otherwise. */
  const [selected, setSelected] = useState<string[]>(() => configurations.map((item) => item.id));

  const name = values.name.trim();
  /** The code follows the new name until the employee types one of their own. */
  const code = values.code.trim() === '' ? derivePlanCode(name) : values.code.trim();

  const isSameName = name !== '' && name.toLowerCase() === plan.name.trim().toLowerCase();
  const nameIssue = submitted && name === '' ? 'Enter a name for the copy.' : undefined;

  function toggle(configurationId: string) {
    setSelected((current) =>
      current.includes(configurationId)
        ? current.filter((id) => id !== configurationId)
        : [...current, configurationId],
    );
  }

  function submit() {
    setSubmitted(true);
    if (name === '' || isSameName) return;

    copy.mutate(
      {
        name,
        ...(code === '' ? {} : { code }),
        description: values.description.trim() === '' ? null : values.description.trim(),
        configurationIds: selected,
      },
      {
        onSuccess: (saved) => {
          notify(`${saved.name} was created from ${plan.name}.`);
          onClose();
          navigate(ROUTES.plans.detail(companyId, saved.id));
        },
        onError: (error) => applyError(error, 'the plan'),
      },
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={`Copy ${plan.name}`}
      description="Choose what comes across. Benefits, their values and their notes are copied with each configuration."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={copy.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={copy.isPending || isSameName}>
            {copy.isPending ? 'Copying…' : 'Create the copy'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {formError ? (
          <Callout tone="danger" title="Could not copy">
            {formError}
          </Callout>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New plan name"
            required
            error={
              fieldErrors.name ??
              (isSameName ? 'Give the copy a different name.' : undefined) ??
              nameIssue
            }
            hint={isSameName ? undefined : 'It cannot be the same as the plan you are copying.'}
          >
            {(props) => (
              <Input
                {...props}
                autoFocus
                value={values.name}
                onChange={(event) => setValue('name', event.target.value)}
                placeholder={`Not "${plan.name}"`}
              />
            )}
          </Field>

          <Field
            label="Plan code"
            error={fieldErrors.code}
            hint="Derived from the name. Unique within the company."
          >
            {(props) => (
              <Input
                {...props}
                value={values.code === '' ? code : values.code}
                onChange={(event) => setValue('code', event.target.value.toUpperCase())}
              />
            )}
          </Field>
        </div>

        <Field label="Description" error={fieldErrors.description}>
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={values.description}
              onChange={(event) => setValue('description', event.target.value)}
            />
          )}
        </Field>

        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-2">
            <legend className="text-content text-sm font-medium">
              What to copy
              <span className="text-content-subtle ml-2 text-xs font-normal">
                {selected.length} of {configurations.length} selected
              </span>
            </legend>

            {configurations.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setSelected(
                    selected.length === configurations.length
                      ? []
                      : configurations.map((item) => item.id),
                  )
                }
                className="text-brand-strong hover:bg-brand-soft rounded-(--radius-control) px-2 py-1 text-xs font-semibold"
              >
                {selected.length === configurations.length ? 'Select none' : 'Select all'}
              </button>
            ) : null}
          </div>

          {configurations.length === 0 ? (
            <p className="text-content-subtle rounded-(--radius-control) border border-dashed px-3 py-4 text-center text-xs">
              This plan has no configurations yet, so only the plan itself is copied.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {configurations.map((configuration) => (
                <ConfigurationChoice
                  key={configuration.id}
                  configuration={configuration}
                  checked={selected.includes(configuration.id)}
                  onToggle={() => toggle(configuration.id)}
                />
              ))}
            </div>
          )}
        </fieldset>
      </div>
    </Dialog>
  );
}

/** One configuration, described the way its card describes it. */
function ConfigurationChoice({
  configuration,
  checked,
  onToggle,
}: {
  configuration: PlanConfigurationDto;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="border-border-subtle bg-surface hover:border-brand-border flex cursor-pointer items-center gap-3 rounded-(--radius-control) border p-3">
      <input
        type="checkbox"
        className="accent-brand size-4 shrink-0"
        checked={checked}
        onChange={onToggle}
      />
      <span className="min-w-0 flex-1">
        <span className="text-content block truncate text-sm font-medium">
          {configurationLabel(configuration.customerType, configuration.geographicalCoverage)}
          <span className="text-content-muted font-normal">
            {' '}
            · ages {configuration.ageFrom}–{configuration.ageTo}
          </span>
        </span>
        <span className="text-content-subtle block text-xs">
          {formatMoney(configuration.annualPrice, configuration.currency)} ·{' '}
          {benefitCountLabel(configuration.options?.length ?? 0)}
        </span>
      </span>
    </label>
  );
}
